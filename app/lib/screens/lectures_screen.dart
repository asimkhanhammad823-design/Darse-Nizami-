import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../services/progress_store.dart';
import '../widgets/list_loader.dart';
import 'player_screen.dart';

class _LectureItem {
  final Lecture lecture;
  final int? positionSeconds;
  _LectureItem(this.lecture, this.positionSeconds);
}

class LecturesScreen extends StatelessWidget {
  final ApiClient apiClient;
  final Book book;

  LecturesScreen({super.key, required this.apiClient, required this.book});

  final _progressStore = ProgressStore();

  Future<List<_LectureItem>> _load() async {
    final lectures = await apiClient.getLectures(book.id);
    final items = <_LectureItem>[];
    for (final lecture in lectures) {
      items.add(_LectureItem(lecture, await _progressStore.readPosition(lecture.id)));
    }
    return items;
  }

  String _formatDuration(int? seconds) {
    if (seconds == null) return '';
    final hours = seconds ~/ 3600;
    final minutes = (seconds % 3600) ~/ 60;
    final secs = seconds % 60;
    if (hours > 0) return '${hours}h ${minutes}m';
    return '${minutes}m ${secs}s';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(book.name)),
      body: ListLoader<_LectureItem>(
        load: _load,
        emptyMessage: 'No lectures yet.',
        itemBuilder: (context, item) {
          final lecture = item.lecture;
          final duration = lecture.durationSeconds;
          final position = item.positionSeconds;
          final hasProgress =
              position != null && position > 10 && duration != null && duration > 0;
          final progress = hasProgress ? (position / duration).clamp(0.0, 1.0) : null;
          return Card(
            child: ListTile(
              leading: Icon(
                hasProgress ? Icons.play_circle : Icons.play_circle_outline,
                color: hasProgress ? Theme.of(context).colorScheme.primary : null,
              ),
              title: Text(lecture.title, style: Theme.of(context).textTheme.titleMedium),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_formatDuration(duration)),
                  if (progress != null) ...[
                    const SizedBox(height: 6),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(value: progress, minHeight: 5),
                    ),
                  ],
                ],
              ),
              trailing: progress != null ? Text('${(progress * 100).round()}%') : null,
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => PlayerScreen(
                      apiClient: apiClient,
                      lecture: lecture,
                    ),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}
