import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../services/auth_storage.dart';
import '../services/progress_store.dart';
import '../widgets/list_loader.dart';
import 'books_screen.dart';
import 'login_screen.dart';
import 'player_screen.dart';

class HomeScreen extends StatefulWidget {
  final ApiClient apiClient;
  final AuthStorage authStorage;

  const HomeScreen({super.key, required this.apiClient, required this.authStorage});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _progressStore = ProgressStore();
  Lecture? _lastPlayed;

  @override
  void initState() {
    super.initState();
    _loadLastPlayed();
  }

  Future<void> _loadLastPlayed() async {
    final lecture = await _progressStore.readLastPlayed();
    if (mounted) setState(() => _lastPlayed = lecture);
  }

  void _openLastPlayed() {
    final lecture = _lastPlayed;
    if (lecture == null) return;
    Navigator.of(context)
        .push(
          MaterialPageRoute(
            builder: (_) => PlayerScreen(apiClient: widget.apiClient, lecture: lecture),
          ),
        )
        .then((_) => _loadLastPlayed());
  }

  Future<void> _logout() async {
    await widget.authStorage.clear();
    widget.apiClient.setToken(null);
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(
        builder: (_) => LoginScreen(
          apiClient: widget.apiClient,
          authStorage: widget.authStorage,
        ),
      ),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Darajas'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Log out',
            onPressed: _logout,
          ),
        ],
      ),
      body: Column(
        children: [
          if (_lastPlayed != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
              child: Card(
                color: Theme.of(context).colorScheme.primary,
                child: ListTile(
                  leading: const Icon(Icons.play_circle_fill, color: Colors.white, size: 36),
                  title: const Text(
                    'Continue listening',
                    style: TextStyle(color: Colors.white70, fontSize: 13),
                  ),
                  subtitle: Text(
                    _lastPlayed!.title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                      fontSize: 16,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  onTap: _openLastPlayed,
                ),
              ),
            ),
          Expanded(child: _buildDarajaList()),
        ],
      ),
    );
  }

  Widget _buildDarajaList() {
    return ListLoader<Daraja>(
        load: () => widget.apiClient.getDarajas(),
        emptyMessage: 'No darajas yet.',
        itemBuilder: (context, daraja) {
          return Card(
            child: ListTile(
              title: Text(daraja.name, style: Theme.of(context).textTheme.titleMedium),
              trailing: const Icon(Icons.chevron_right),
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => BooksScreen(
                      apiClient: widget.apiClient,
                      daraja: daraja,
                    ),
                  ),
                );
              },
            ),
          );
        },
      );
  }
}
