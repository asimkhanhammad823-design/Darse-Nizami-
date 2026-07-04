import 'package:flutter/material.dart';
import 'package:flutter_windowmanager/flutter_windowmanager.dart';
import 'package:just_audio_background/just_audio_background.dart';

import 'api/api_client.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'services/auth_storage.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Blocks screenshots and screen recording at the OS level for the whole
  // app (a Flutter app runs in a single Activity, so one call here secures
  // every screen).
  await FlutterWindowManager.addFlags(FlutterWindowManager.FLAG_SECURE);

  // Enables background playback + lock-screen controls for just_audio.
  await JustAudioBackground.init(
    androidNotificationChannelId: 'com.darsenizami.audio.channel',
    androidNotificationChannelName: 'Dars-e-Nizami Playback',
    androidNotificationOngoing: true,
  );

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
  String? _token;

  @override
  void initState() {
    super.initState();
    _loadToken();
  }

  Future<void> _loadToken() async {
    final token = await _authStorage.readToken();
    setState(() {
      _token = token;
      _checking = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_checking) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_token != null) {
      _apiClient.setToken(_token);
      return HomeScreen(apiClient: _apiClient, authStorage: _authStorage);
    }
    return LoginScreen(apiClient: _apiClient, authStorage: _authStorage);
  }
}
