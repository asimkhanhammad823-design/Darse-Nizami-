import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import 'lectures_screen.dart';

class BooksScreen extends StatefulWidget {
  final ApiClient apiClient;
  final Daraja daraja;

  const BooksScreen({super.key, required this.apiClient, required this.daraja});

  @override
  State<BooksScreen> createState() => _BooksScreenState();
}

class _BooksScreenState extends State<BooksScreen> {
  late Future<List<Book>> _booksFuture;

  @override
  void initState() {
    super.initState();
    _booksFuture = widget.apiClient.getBooks(widget.daraja.id);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.daraja.name)),
      body: FutureBuilder<List<Book>>(
        future: _booksFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(child: Text('Failed to load: ${snapshot.error}'));
          }
          final books = snapshot.data ?? [];
          if (books.isEmpty) {
            return const Center(child: Text('No books yet.'));
          }
          return ListView.separated(
            padding: const EdgeInsets.all(12),
            itemCount: books.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final book = books[index];
              return Card(
                child: ListTile(
                  title: Text(book.name, style: Theme.of(context).textTheme.titleMedium),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => LecturesScreen(
                          apiClient: widget.apiClient,
                          book: book,
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
