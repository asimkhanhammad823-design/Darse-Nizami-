import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../services/auth_storage.dart';
import '../widgets/list_loader.dart';
import 'books_screen.dart';
import 'login_screen.dart';

class HomeScreen extends StatefulWidget {
  final ApiClient apiClient;
  final AuthStorage authStorage;

  const HomeScreen({super.key, required this.apiClient, required this.authStorage});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
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
      body: ListLoader<Daraja>(
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
      ),
    );
  }
}
