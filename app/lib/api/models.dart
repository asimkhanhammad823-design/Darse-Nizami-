class Daraja {
  final int id;
  final String name;

  Daraja({required this.id, required this.name});

  factory Daraja.fromJson(Map<String, dynamic> json) {
    return Daraja(id: json['id'] as int, name: json['name'] as String);
  }
}

class Book {
  final int id;
  final int darajaId;
  final String name;

  Book({required this.id, required this.darajaId, required this.name});

  factory Book.fromJson(Map<String, dynamic> json) {
    return Book(
      id: json['id'] as int,
      darajaId: json['daraja_id'] as int,
      name: json['name'] as String,
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
      id: json['id'] as int,
      bookId: json['book_id'] as int,
      title: json['title'] as String,
      durationSeconds: json['duration_seconds'] as int?,
    );
  }
}

class PageMarker {
  final int id;
  final int timeSeconds;
  final int pageNumber;

  PageMarker({
    required this.id,
    required this.timeSeconds,
    required this.pageNumber,
  });

  factory PageMarker.fromJson(Map<String, dynamic> json) {
    return PageMarker(
      id: json['id'] as int,
      timeSeconds: json['time_seconds'] as int,
      pageNumber: json['page_number'] as int,
    );
  }

  /// Returns the page number active at [positionSeconds], per the rule:
  /// the marker with the largest time_seconds <= positionSeconds.
  /// Returns null if positionSeconds is before the first marker.
  static int? pageAt(List<PageMarker> sortedMarkers, int positionSeconds) {
    int? page;
    for (final marker in sortedMarkers) {
      if (marker.timeSeconds <= positionSeconds) {
        page = marker.pageNumber;
      } else {
        break;
      }
    }
    return page;
  }
}
