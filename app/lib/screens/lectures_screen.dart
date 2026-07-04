import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import 'player_screen.dart';

class LecturesScreen extends StatefulWidget {
  final ApiClient apiClient;
  final Book book;

  const LecturesScreen({super.key, required this.apiClient, required this.book});

  @override
  State<LecturesScreen> createState() => _LecturesScreenState();
}

class _LecturesScreenState extends State<LecturesScreen> {
  late Future<List<Lecture>> _lecturesFuture;

  @override
  void initState() {
    super.initState();
    _lecturesFuture = widget.apiClient.getLectures(widget.book.id);
  }

  String _formatDuration(int? seconds) {
    if (seconds == null) return '';
    final minutes = seconds ~/ 60;
    final secs = seconds % 60;
    return '${minutes}m ${secs}s';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.book.name)),
      body: FutureBuilder<List<Lecture>>(
        future: _lecturesFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(child: Text('Failed to load: ${snapshot.error}'));
          }
          final lectures = snapshot.data ?? [];
          if (lectures.isEmpty) {
            return const Center(child: Text('No lectures yet.'));
          }
          return ListView.separated(
            padding: const EdgeInsets.all(12),
            itemCount: lectures.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final lecture = lectures[index];
              return Card(
                child: ListTile(
                  leading: const Icon(Icons.play_circle_outline),
                  title: Text(lecture.title, style: Theme.of(context).textTheme.titleMedium),
                  subtitle: Text(_formatDuration(lecture.durationSeconds)),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => PlayerScreen(
                          apiClient: widget.apiClient,
                          lecture: lecture,
                        ),
                      ),
                    );
                  },
                ),
              );
            },
          );
        },
      ),
    );
  }
}
