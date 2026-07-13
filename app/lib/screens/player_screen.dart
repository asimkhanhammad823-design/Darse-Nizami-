import 'dart:async';

import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../services/progress_store.dart';
import '../theme.dart';

class PlayerScreen extends StatefulWidget {
  final ApiClient apiClient;
  final Lecture lecture;

  const PlayerScreen({super.key, required this.apiClient, required this.lecture});

  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends State<PlayerScreen> {
  final AudioPlayer _player = AudioPlayer();
  final ProgressStore _progressStore = ProgressStore();
  List<PageMarker> _markers = [];
  bool _loading = true;
  String? _error;
  double _speed = 1.0;
  StreamSubscription? _errorSubscription;
  StreamSubscription<Duration>? _positionSubscription;
  StreamSubscription<ProcessingState>? _processingSubscription;
  int _lastSavedSeconds = -1;
  bool _recovering = false;
  int _recoveryAttempts = 0;
  Timer? _sleepTimer;
  int? _sleepMinutes;

  // Signed image URLs fetched lazily per marker (once it becomes the active
  // page), cached so we don't refetch. markerId → url. A value of '' means a
  // fetch is in flight or failed.
  final Map<int, String> _imageUrls = {};
  final Set<int> _imageFetching = {};

  // Cap how many times we silently refetch a fresh stream URL after a
  // playback error, so a persistently-broken stream can't turn into a tight
  // request loop against the server.
  static const _maxRecoveryAttempts = 3;

  static const _speeds = [1.0, 1.25, 1.5, 2.0];
  static const _sleepOptions = [15, 30, 60];

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    // Cancel any subscriptions from a previous attempt (e.g. Retry) so they
    // aren't leaked/duplicated when we re-subscribe below.
    await _errorSubscription?.cancel();
    await _positionSubscription?.cancel();
    await _processingSubscription?.cancel();
    _errorSubscription = null;
    _positionSubscription = null;
    _processingSubscription = null;

    setState(() {
      _loading = true;
      _error = null;
    });
    _recoveryAttempts = 0;
    try {
      final markers = await widget.apiClient.getMarkers(widget.lecture.id);
      // Defensive: the "Safa" logic and the page list both assume markers are
      // in ascending time order. The API already sorts, but re-sort locally
      // so a change there can never show the wrong page.
      markers.sort((a, b) => a.timeSeconds.compareTo(b.timeSeconds));
      if (!mounted) return;
      setState(() => _markers = markers);
      // Remember this as the most recent lecture for the home screen's
      // "continue listening" card.
      unawaited(_progressStore.saveLastPlayed(widget.lecture));

      // Resume where the student left off last time (kept on-device only).
      final savedSeconds = await _progressStore.readPosition(widget.lecture.id);
      Duration? initialPosition;
      if (savedSeconds != null && savedSeconds > 10) {
        final total = widget.lecture.durationSeconds;
        if (total == null || savedSeconds < total - 15) {
          initialPosition = Duration(seconds: savedSeconds);
        }
      }
      // Guard the audio load with a timeout so a stalled stream shows a
      // friendly Retry instead of spinning forever.
      await _loadAudioSource(initialPosition: initialPosition)
          .timeout(const Duration(seconds: 30));

      // The signed stream URL eventually expires. If a later seek/request
      // fails because of that, transparently fetch a fresh URL and resume
      // from the same position instead of surfacing an error to the user.
      _errorSubscription = _player.playbackEventStream.listen(
        (_) {},
        onError: (Object e, StackTrace st) async {
          if (_recovering) return;
          if (_recoveryAttempts >= _maxRecoveryAttempts) {
            // Give up silently refetching; show the retry UI instead of
            // hammering the server in a tight loop.
            if (mounted) setState(() => _error = 'Playback stopped. Please try again.');
            return;
          }
          _recovering = true;
          _recoveryAttempts++;
          final position = _player.position;
          final wasPlaying = _player.playing;
          try {
            await _loadAudioSource(initialPosition: position, autoplay: wasPlaying);
            _recoveryAttempts = 0; // recovered — reset the counter
          } catch (_) {
            // Genuine failure (no internet, lecture removed, etc.)
          } finally {
            _recovering = false;
          }
        },
      );

      // Periodically remember the playback position for resume-on-return.
      _positionSubscription = _player.positionStream.listen((position) {
        final seconds = position.inSeconds;
        if ((seconds - _lastSavedSeconds).abs() >= 5) {
          _lastSavedSeconds = seconds;
          _progressStore.savePosition(widget.lecture.id, seconds);
        }
      });

      // A finished lecture should restart from the beginning next time.
      _processingSubscription = _player.processingStateStream.listen((state) {
        if (state == ProcessingState.completed) {
          _lastSavedSeconds = -1;
          _progressStore.clearPosition(widget.lecture.id);
        }
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) {
        setState(() => _error = 'Could not load this lecture. Please try again.');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadAudioSource({Duration? initialPosition, bool autoplay = false}) async {
    final url = await widget.apiClient.getStreamUrl(widget.lecture.id);
    await _player.setAudioSource(
      AudioSource.uri(Uri.parse(url)),
      initialPosition: initialPosition,
    );
    await _player.setSpeed(_speed);
    if (autoplay) await _player.play();
  }

  @override
  void dispose() {
    // Save the final position before tearing the player down.
    final seconds = _player.position.inSeconds;
    if (seconds > 0) {
      _progressStore.savePosition(widget.lecture.id, seconds);
    }
    _errorSubscription?.cancel();
    _positionSubscription?.cancel();
    _processingSubscription?.cancel();
    _sleepTimer?.cancel();
    _player.dispose();
    super.dispose();
  }

  void _setSleepTimer(int? minutes) {
    _sleepTimer?.cancel();
    setState(() => _sleepMinutes = minutes);
    if (minutes != null) {
      _sleepTimer = Timer(Duration(minutes: minutes), () {
        _player.pause();
        if (mounted) setState(() => _sleepMinutes = null);
      });
    }
  }

  /// Bottom sheet listing every page marker so the student can jump straight
  /// to where a given safa starts.
  void _showPageList() {
    showModalBottomSheet(
      context: context,
      builder: (sheetContext) {
        return SafeArea(
          child: ListView.builder(
            shrinkWrap: true,
            itemCount: _markers.length,
            itemBuilder: (context, index) {
              final marker = _markers[index];
              return ListTile(
                leading: const Icon(Icons.menu_book, color: kNavy),
                title: Text('Safa ${marker.pageNumber}'),
                trailing: Text(_formatDuration(Duration(seconds: marker.timeSeconds))),
                onTap: () {
                  Navigator.of(sheetContext).pop();
                  _player.seek(Duration(seconds: marker.timeSeconds));
                  _player.play();
                },
              );
            },
          ),
        );
      },
    );
  }

  String _formatDuration(Duration d) {
    final minutes = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    final hours = d.inHours;
    if (hours > 0) {
      return '$hours:$minutes:$seconds';
    }
    return '$minutes:$seconds';
  }

  String _formatSpeed(double speed) {
    // "1x", "1.25x", "1.5x", "2x" — no trailing ".0".
    final text = speed == speed.roundToDouble() ? speed.toInt().toString() : speed.toString();
    return '${text}x';
  }

  void _seekRelative(int deltaSeconds) {
    final newPosition = _player.position + Duration(seconds: deltaSeconds);
    final duration = _player.duration;
    var clamped = newPosition < Duration.zero ? Duration.zero : newPosition;
    // Only clamp to the end when the real duration is known; a null/zero
    // duration would otherwise snap every forward-seek back to 0:00.
    if (duration != null && duration > Duration.zero && clamped > duration) {
      clamped = duration;
    }
    _player.seek(clamped);
  }

  Future<void> _setSpeed(double speed) async {
    setState(() => _speed = speed);
    await _player.setSpeed(speed);
  }

  /// Fetch the signed image URL for a marker the first time its page becomes
  /// active. Cached; failures fall back to showing the page number.
  void _ensureImageUrl(PageMarker marker) {
    if (_imageUrls.containsKey(marker.id) || _imageFetching.contains(marker.id)) return;
    _imageFetching.add(marker.id);
    widget.apiClient.getMarkerImageUrl(marker.id).then((url) {
      if (!mounted) return;
      setState(() {
        _imageUrls[marker.id] = url;
        _imageFetching.remove(marker.id);
      });
    }).catchError((_) {
      if (!mounted) return;
      setState(() => _imageFetching.remove(marker.id));
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.lecture.title)),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _buildError()
              : _buildPlayer(),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off, size: 48, color: Colors.black38),
            const SizedBox(height: 12),
            Text(_error!, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _init,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlayer() {
    return Column(
      children: [
        Expanded(
          child: Center(
            child: StreamBuilder<Duration>(
              stream: _player.positionStream,
              builder: (context, snapshot) {
                final position = snapshot.data ?? Duration.zero;
                final marker = PageMarker.markerAt(_markers, position.inSeconds);
                if (marker == null) {
                  return const SizedBox.shrink();
                }
                // If this page has an image, show it (fetch lazily). While
                // it loads, or if it has no image, show the big Safa number.
                if (marker.hasImage) {
                  _ensureImageUrl(marker);
                  final url = _imageUrls[marker.id];
                  if (url != null && url.isNotEmpty) {
                    return _buildPageImage(url, marker.pageNumber);
                  }
                }
                return _buildPageNumber(marker.pageNumber);
              },
            ),
          ),
        ),
        _buildControls(),
      ],
    );
  }

  Widget _buildPageNumber(int page) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text('Safa', style: TextStyle(fontSize: 20, color: Colors.black54)),
        const SizedBox(height: 8),
        Text(
          '$page',
          style: const TextStyle(fontSize: 96, fontWeight: FontWeight.bold, color: kNavy),
        ),
      ],
    );
  }

  Widget _buildPageImage(String url, int page) {
    return Column(
      children: [
        Expanded(
          child: InteractiveViewer(
            minScale: 1,
            maxScale: 4,
            child: Center(
              child: Image.network(
                url,
                fit: BoxFit.contain,
                loadingBuilder: (context, child, progress) {
                  if (progress == null) return child;
                  return const Center(child: CircularProgressIndicator());
                },
                errorBuilder: (context, error, stack) => _buildPageNumber(page),
              ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text('Safa $page', style: const TextStyle(color: Colors.black54)),
        ),
      ],
    );
  }

  Widget _buildControls() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          StreamBuilder<Duration?>(
            stream: _player.durationStream,
            builder: (context, durationSnapshot) {
              final duration = durationSnapshot.data ?? Duration.zero;
              return StreamBuilder<Duration>(
                stream: _player.positionStream,
                builder: (context, positionSnapshot) {
                  var position = positionSnapshot.data ?? Duration.zero;
                  if (position > duration) position = duration;
                  return Column(
                    children: [
                      Slider(
                        value: position.inMilliseconds.toDouble(),
                        max: duration.inMilliseconds.toDouble().clamp(1, double.infinity),
                        onChanged: (value) {
                          _player.seek(Duration(milliseconds: value.toInt()));
                        },
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(_formatDuration(position)),
                            Text(_formatDuration(duration)),
                          ],
                        ),
                      ),
                    ],
                  );
                },
              );
            },
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton(
                iconSize: 36,
                icon: const Icon(Icons.replay_10),
                onPressed: () => _seekRelative(-10),
              ),
              const SizedBox(width: 16),
              StreamBuilder<PlayerState>(
                stream: _player.playerStateStream,
                builder: (context, snapshot) {
                  final playing = snapshot.data?.playing ?? false;
                  return IconButton(
                    iconSize: 56,
                    icon: Icon(playing ? Icons.pause_circle_filled : Icons.play_circle_filled),
                    color: kNavy,
                    onPressed: () {
                      if (playing) {
                        _player.pause();
                      } else {
                        _player.play();
                      }
                    },
                  );
                },
              ),
              const SizedBox(width: 16),
              IconButton(
                iconSize: 36,
                icon: const Icon(Icons.forward_10),
                onPressed: () => _seekRelative(10),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            alignment: WrapAlignment.center,
            children: _speeds.map((speed) {
              final selected = speed == _speed;
              return ChoiceChip(
                label: Text(_formatSpeed(speed)),
                selected: selected,
                onSelected: (_) => _setSpeed(speed),
              );
            }).toList(),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (_markers.isNotEmpty)
                TextButton.icon(
                  icon: const Icon(Icons.menu_book),
                  label: const Text('Safa list'),
                  onPressed: _showPageList,
                ),
              PopupMenuButton<int>(
                tooltip: 'Sleep timer',
                onSelected: (minutes) => _setSleepTimer(minutes == 0 ? null : minutes),
                itemBuilder: (context) => [
                  const PopupMenuItem(value: 0, child: Text('Timer off')),
                  for (final minutes in _sleepOptions)
                    PopupMenuItem(value: minutes, child: Text('Stop after $minutes min')),
                ],
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.bedtime, size: 20, color: _sleepMinutes != null ? kTeal : kNavy),
                      const SizedBox(width: 6),
                      Text(
                        _sleepMinutes != null ? 'Sleep: $_sleepMinutes min' : 'Sleep timer',
                        style: const TextStyle(color: kNavy),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
