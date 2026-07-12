import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../api/models.dart';

/// Remembers listening state on-device only: where the student left off in
/// each lecture, and which lecture they played last (for the "continue
/// listening" card on the home screen). Only ids/titles/positions are
/// stored — never any audio data.
class ProgressStore {
  static String _key(int lectureId) => 'lecture_position_$lectureId';
  static const _lastPlayedKey = 'last_played_lecture';

  Future<void> savePosition(int lectureId, int positionSeconds) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_key(lectureId), positionSeconds);
  }

  Future<int?> readPosition(int lectureId) async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt(_key(lectureId));
  }

  Future<void> clearPosition(int lectureId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key(lectureId));
  }

  Future<void> saveLastPlayed(Lecture lecture) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _lastPlayedKey,
      jsonEncode({
        'id': lecture.id,
        'book_id': lecture.bookId,
        'title': lecture.title,
        'duration_seconds': lecture.durationSeconds,
      }),
    );
  }

  Future<Lecture?> readLastPlayed() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_lastPlayedKey);
    if (raw == null) return null;
    try {
      return Lecture.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }
}
