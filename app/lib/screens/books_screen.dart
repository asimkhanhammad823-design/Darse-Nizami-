import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../widgets/list_loader.dart';
import 'lectures_screen.dart';

class BooksScreen extends StatelessWidget {
  final ApiClient apiClient;
  final Daraja daraja;

  const BooksScreen({super.key, required this.apiClient, required this.daraja});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(daraja.name)),
      body: ListLoader<Book>(
        load: () => apiClient.getBooks(daraja.id),
        emptyMessage: 'No books yet.',
        itemBuilder: (context, book) {
          return Card(
            child: ListTile(
              title: Text(book.name, style: Theme.of(context).textTheme.titleMedium),
              trailing: const Icon(Icons.chevron_right),
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => LecturesScreen(
                      apiClient: apiClient,
                      book: book,
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
