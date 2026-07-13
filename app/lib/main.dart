import 'package:flutter/material.dart';

import 'api/api_client.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'services/auth_storage.dart';
import 'theme.dart';

/// Global navigator so the API client can force a return to the login
/// screen when the session token expires, from anywhere in the app.
final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Screenshot/screen-recording blocking (FLAG_SECURE) is applied natively
  // in MainActivity.kt — see app/tool/patch_android_project.py — so it takes
  // effect before the first frame and needs no plugin.

  runApp(const DarsNizamiApp());
}

class DarsNizamiApp extends StatelessWidget {
  const DarsNizamiApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Dars-e-Nizami',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      navigatorKey: navigatorKey,
      home: const _StartupGate(),
    );
  }
}

/// Decides whether to show the login screen or jump straight to Home,
/// based on whether a session token is already stored.
class _StartupGate extends StatefulWidget {
  const _StartupGate();

  @override
  State<_StartupGate> createState() => _StartupGateState();
}

class _StartupGateState extends State<_StartupGate> {
  final _authStorage = AuthStorage();
  final _apiClient = ApiClient();
  bool _checking = true;
  bool _loggingOut = false;
  String? _token;

  @override
  void initState() {
    super.initState();
    _apiClient.onUnauthorized = _handleSessionExpired;
    _loadToken();
  }

  Future<void> _loadToken() async {
    final token = await _authStorage.readToken();
    if (token != null) _apiClient.setToken(token);
    setState(() {
      _token = token;
      _checking = false;
    });
  }

  /// Called by ApiClient whenever an authenticated request comes back 401
  /// (e.g. the 30-day token expired or the access code was revoked).
  Future<void> _handleSessionExpired() async {
    if (_loggingOut) return;
    _loggingOut = true;
    try {
      await _authStorage.clear();
      _apiClient.setToken(null);
      navigatorKey.currentState?.pushAndRemoveUntil(
        MaterialPageRoute(
          builder: (_) => LoginScreen(
            apiClient: _apiClient,
            authStorage: _authStorage,
            message: 'Your session has expired. Please log in again.',
          ),
        ),
        (route) => false,
      );
    } finally {
      _loggingOut = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_checking) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_token != null) {
      return HomeScreen(apiClient: _apiClient, authStorage: _authStorage);
    }
    return LoginScreen(apiClient: _apiClient, authStorage: _authStorage);
  }
}
