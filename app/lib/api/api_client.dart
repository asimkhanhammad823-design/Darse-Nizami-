import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import 'models.dart';

class ApiException implements Exception {
  final int statusCode;
  final String message;
  ApiException(this.statusCode, this.message);

  bool get isNetworkError => statusCode == 0;

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

const Duration _kRequestTimeout = Duration(seconds: 20);

class ApiClient {
  String? _token;

  /// Invoked when an authenticated request returns 401, so the app can
  /// clear the stored token and return to the login screen.
  Future<void> Function()? onUnauthorized;

  void setToken(String? token) {
    _token = token;
  }

  Map<String, String> get _authHeaders =>
      _token == null ? {} : {'authorization': 'Bearer $_token'};

  Future<dynamic> _get(String path) async {
    final http.Response response;
    try {
      response = await http
          .get(Uri.parse('$kWorkerBaseUrl$path'), headers: _authHeaders)
          .timeout(_kRequestTimeout);
    } on SocketException {
      throw ApiException(0, 'No internet connection. Please check your network and try again.');
    } on TimeoutException {
      throw ApiException(0, 'The server took too long to respond. Please try again.');
    } on http.ClientException {
      throw ApiException(0, 'Could not reach the server. Please try again.');
    }
    if (response.statusCode == 401) {
      // Session token expired/revoked — let the app force a re-login.
      final handler = onUnauthorized;
      if (handler != null) unawaited(handler());
    }
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
    final http.Response response;
    try {
      response = await http
          .post(
            Uri.parse('$kWorkerBaseUrl/login'),
            headers: {'content-type': 'application/json'},
            body: jsonEncode({'access_code': accessCode}),
          )
          .timeout(_kRequestTimeout);
    } on SocketException {
      throw ApiException(0, 'No internet connection. Please check your network and try again.');
    } on TimeoutException {
      throw ApiException(0, 'The server took too long to respond. Please try again.');
    } on http.ClientException {
      throw ApiException(0, 'Could not reach the server. Please try again.');
    }
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
