import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../widgets/list_loader.dart';
import 'player_screen.dart';

class LecturesScreen extends StatelessWidget {
  final ApiClient apiClient;
  final Book book;

  const LecturesScreen({super.key, required this.apiClient, required this.book});

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
      body: ListLoader<Lecture>(
        load: () => apiClient.getLectures(book.id),
        emptyMessage: 'No lectures yet.',
        itemBuilder: (context, lecture) {
          return Card(
            child: ListTile(
              leading: const Icon(Icons.play_circle_outline),
              title: Text(lecture.title, style: Theme.of(context).textTheme.titleMedium),
              subtitle: Text(_formatDuration(lecture.durationSeconds)),
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
