import 'package:flutter/material.dart';

import '../api/api_client.dart';

/// Shared list screen body: loading spinner, pull-to-refresh, an empty
/// message, and a friendly error state with a Retry button.
class ListLoader<T> extends StatefulWidget {
  final Future<List<T>> Function() load;
  final Widget Function(BuildContext context, T item) itemBuilder;
  final String emptyMessage;

  const ListLoader({
    super.key,
    required this.load,
    required this.itemBuilder,
    required this.emptyMessage,
  });

  @override
  State<ListLoader<T>> createState() => _ListLoaderState<T>();
}

class _ListLoaderState<T> extends State<ListLoader<T>> {
  late Future<List<T>> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.load();
  }

  Future<void> _reload() async {
    final future = widget.load();
    setState(() => _future = future);
    await future.catchError((_) => <T>[]);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<T>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          final error = snapshot.error;
          final message = error is ApiException
              ? error.message
              : 'Something went wrong. Please try again.';
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.cloud_off, size: 48, color: Colors.black38),
                  const SizedBox(height: 12),
                  Text(message, textAlign: TextAlign.center),
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    onPressed: _reload,
                    icon: const Icon(Icons.refresh),
                    label: const Text('Retry'),
                  ),
                ],
              ),
            ),
          );
        }
        final items = snapshot.data ?? [];
        return RefreshIndicator(
          onRefresh: _reload,
          child: items.isEmpty
              ? ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: [
                    SizedBox(
                      height: MediaQuery.of(context).size.height * 0.6,
                      child: Center(child: Text(widget.emptyMessage)),
                    ),
                  ],
                )
              : ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(12),
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, index) =>
                      widget.itemBuilder(context, items[index]),
                ),
        );
      },
    );
  }
}
