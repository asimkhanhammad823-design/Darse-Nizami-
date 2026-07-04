import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../services/auth_storage.dart';
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
  late Future<List<Daraja>> _darajasFuture;

  @override
  void initState() {
    super.initState();
    _darajasFuture = widget.apiClient.getDarajas();
  }

  Future<void> _logout() async {
    await widget.authStorage.clear();
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
          IconButton(icon: const Icon(Icons.logout), onPressed: _logout),
        ],
      ),
      body: FutureBuilder<List<Daraja>>(
        future: _darajasFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(child: Text('Failed to load: ${snapshot.error}'));
          }
          final darajas = snapshot.data ?? [];
          if (darajas.isEmpty) {
            return const Center(child: Text('No darajas yet.'));
          }
          return ListView.separated(
            padding: const EdgeInsets.all(12),
            itemCount: darajas.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final daraja = darajas[index];
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
        },
      ),
    );
  }
}
