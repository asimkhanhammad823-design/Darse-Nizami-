import 'package:shared_preferences/shared_preferences.dart';

/// Remembers where the student left off in each lecture, on-device only.
/// Only positions (integers) are stored — never any audio data.
class ProgressStore {
  static String _key(int lectureId) => 'lecture_position_$lectureId';

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
}
