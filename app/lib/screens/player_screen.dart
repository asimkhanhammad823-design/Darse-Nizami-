import 'dart:async';

import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import 'package:just_audio_background/just_audio_background.dart';

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

  static const _speeds = [1.0, 1.25, 1.5, 2.0];

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final markers = await widget.apiClient.getMarkers(widget.lecture.id);
      if (!mounted) return;
      setState(() => _markers = markers);

      // Resume where the student left off last time (kept on-device only).
      final savedSeconds = await _progressStore.readPosition(widget.lecture.id);
      Duration? initialPosition;
      if (savedSeconds != null && savedSeconds > 10) {
        final total = widget.lecture.durationSeconds;
        if (total == null || savedSeconds < total - 15) {
          initialPosition = Duration(seconds: savedSeconds);
        }
      }
      await _loadAudioSource(initialPosition: initialPosition);

      // The signed stream URL eventually expires. If a later seek/request
      // fails because of that, transparently fetch a fresh URL and resume
      // from the same position instead of surfacing an error to the user.
      _errorSubscription = _player.playbackEventStream.listen(
        (_) {},
        onError: (Object e, StackTrace st) async {
          if (_recovering) return;
          _recovering = true;
          final position = _player.position;
          final wasPlaying = _player.playing;
          try {
            await _loadAudioSource(initialPosition: position, autoplay: wasPlaying);
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
      AudioSource.uri(
        Uri.parse(url),
        tag: MediaItem(
          id: widget.lecture.id.toString(),
          title: widget.lecture.title,
          artist: 'Dars-e-Nizami',
        ),
      ),
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
    _player.dispose();
    super.dispose();
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
                final page = PageMarker.pageAt(_markers, position.inSeconds);
                if (page == null) {
                  return const SizedBox.shrink();
                }
                return Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'Safa',
                      style: TextStyle(fontSize: 20, color: Colors.black54),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '$page',
                      style: const TextStyle(
                        fontSize: 96,
                        fontWeight: FontWeight.bold,
                        color: kNavy,
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ),
        _buildControls(),
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
                icon: const Icon(Icons.replay_15),
                onPressed: () => _seekRelative(-15),
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
                icon: const Icon(Icons.forward_15),
                onPressed: () => _seekRelative(15),
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
        ],
      ),
    );
  }
}
