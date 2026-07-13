// Defensive JSON coercion: D1 returns integers as ints, but tolerate a
// number arriving as a double/string so a stray value never crashes a list.
int _asInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? 0;
  return 0;
}

int? _asIntOrNull(Object? value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value);
  return null;
}

String _asString(Object? value) => value?.toString() ?? '';

class Daraja {
  final int id;
  final String name;

  Daraja({required this.id, required this.name});

  factory Daraja.fromJson(Map<String, dynamic> json) {
    return Daraja(id: _asInt(json['id']), name: _asString(json['name']));
  }
}

class Book {
  final int id;
  final int darajaId;
  final String name;

  Book({required this.id, required this.darajaId, required this.name});

  factory Book.fromJson(Map<String, dynamic> json) {
    return Book(
      id: _asInt(json['id']),
      darajaId: _asInt(json['daraja_id']),
      name: _asString(json['name']),
    );
  }
}

class Lecture {
  final int id;
  final int bookId;
  final String title;
  final int? durationSeconds;

  Lecture({
    required this.id,
    required this.bookId,
    required this.title,
    required this.durationSeconds,
  });

  factory Lecture.fromJson(Map<String, dynamic> json) {
    return Lecture(
      id: _asInt(json['id']),
      bookId: _asInt(json['book_id']),
      title: _asString(json['title']),
      durationSeconds: _asIntOrNull(json['duration_seconds']),
    );
  }
}

class PageMarker {
  final int id;
  final int timeSeconds;
  final int pageNumber;
  final bool hasImage;

  PageMarker({
    required this.id,
    required this.timeSeconds,
    required this.pageNumber,
    required this.hasImage,
  });

  factory PageMarker.fromJson(Map<String, dynamic> json) {
    return PageMarker(
      id: _asInt(json['id']),
      timeSeconds: _asInt(json['time_seconds']),
      pageNumber: _asInt(json['page_number']),
      hasImage: _asInt(json['has_image']) == 1,
    );
  }

  /// Returns the marker active at [positionSeconds], per the rule: the marker
  /// with the largest time_seconds <= positionSeconds. Null if the position
  /// is before the first marker. [sortedMarkers] must be ascending by time.
  static PageMarker? markerAt(List<PageMarker> sortedMarkers, int positionSeconds) {
    PageMarker? active;
    for (final marker in sortedMarkers) {
      if (marker.timeSeconds <= positionSeconds) {
        active = marker;
      } else {
        break;
      }
    }
    return active;
  }

  /// Convenience: the page number active at [positionSeconds], or null.
  static int? pageAt(List<PageMarker> sortedMarkers, int positionSeconds) =>
      markerAt(sortedMarkers, positionSeconds)?.pageNumber;
}
