import 'dart:convert';
import 'package:http/http.dart' as http;

import 'models.dart';

class ApiException implements Exception {
  final int statusCode;
  final String message;
  ApiException(this.statusCode, this.message);

  @override
  String toString() => message;
}

/// Base URL of the deployed Cloudflare Worker (Phase 1).
/// Override at build time with:
///   flutter build apk --dart-define=WORKER_BASE_URL=https://your-worker.workers.dev
const String kWorkerBaseUrl = String.fromEnvironment(
  'WORKER_BASE_URL',
  defaultValue: 'https://dars-worker.ateekkhan-dars.workers.dev',
);

class ApiClient {
  String? _token;

  void setToken(String? token) {
    _token = token;
  }

  Map<String, String> get _authHeaders =>
      _token == null ? {} : {'authorization': 'Bearer $_token'};

  Future<dynamic> _get(String path) async {
    final response = await http.get(
      Uri.parse('$kWorkerBaseUrl$path'),
      headers: _authHeaders,
    );
    return _handle(response);
  }

  dynamic _handle(http.Response response) {
    if (response.statusCode >= 400) {
      String message = 'Request failed (${response.statusCode})';
      try {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        message = body['error']?.toString() ?? message;
      } catch (_) {
        // ignore parse failure, use default message
      }
      throw ApiException(response.statusCode, message);
    }
    if (response.body.isEmpty) return null;
    return jsonDecode(response.body);
  }

  /// Returns the session token on success, throws ApiException otherwise.
  Future<String> login(String accessCode) async {
    final response = await http.post(
      Uri.parse('$kWorkerBaseUrl/login'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({'access_code': accessCode}),
    );
    final data = _handle(response) as Map<String, dynamic>;
    return data['token'] as String;
  }

  Future<List<Daraja>> getDarajas() async {
    final data = await _get('/darajas') as List<dynamic>;
    return data.map((e) => Daraja.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<Book>> getBooks(int darajaId) async {
    final data = await _get('/darajas/$darajaId/books') as List<dynamic>;
    return data.map((e) => Book.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<Lecture>> getLectures(int bookId) async {
    final data = await _get('/books/$bookId/lectures') as List<dynamic>;
    return data.map((e) => Lecture.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<PageMarker>> getMarkers(int lectureId) async {
    final data = await _get('/lectures/$lectureId/markers') as List<dynamic>;
    return data.map((e) => PageMarker.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<String> getStreamUrl(int lectureId) async {
    final data = await _get('/lectures/$lectureId/stream-url') as Map<String, dynamic>;
    return data['url'] as String;
  }
}
