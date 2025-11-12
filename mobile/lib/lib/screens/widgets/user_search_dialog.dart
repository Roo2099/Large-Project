import 'package:flutter/material.dart';

import '../../services/api_service.dart';

class UserSearchDialog extends StatefulWidget {
  const UserSearchDialog({super.key});

  @override
  State<UserSearchDialog> createState() => UserSearchDialogState();
}

class UserSearchDialogState extends State<UserSearchDialog> {
  final TextEditingController _query = TextEditingController();
  List<Map<String, dynamic>> _results = <Map<String, dynamic>>[];
  bool _loading = false;

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    final String q = _query.text.trim();
    if (q.isEmpty) {
      setState(() => _results = <Map<String, dynamic>>[]);
      return;
    }
    setState(() => _loading = true);
    final List<Map<String, dynamic>> users = await ApiService.searchUsers(q);
    setState(() {
      _results = users;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520, maxHeight: 600),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Row(
                children: <Widget>[
                  Expanded(
                    child: TextField(
                      controller: _query,
                      decoration: const InputDecoration(
                        hintText: 'Search users by name...',
                        prefixIcon: Icon(Icons.search),
                      ),
                      onSubmitted: (_) => _search(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton(
                    onPressed: _search,
                    child: const Text('Search'),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : ListView.builder(
                      itemCount: _results.length,
                      itemBuilder: (BuildContext context, int index) {
                        final Map<String, dynamic> u = _results[index];
                        final String name = '${u['FirstName'] ?? ''} ${u['LastName'] ?? ''}'
                            .trim();
                        final String id = (u['UserID'] ?? u['id'] ?? '').toString();
                        return ListTile(
                          title: Text(name.isEmpty ? 'User $id' : name),
                          subtitle: Text('ID: $id'),
                          onTap: () => Navigator.pop(context, u),
                        );
                      },
                    ),
            ),
            const Divider(height: 1),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Padding(
                  padding: EdgeInsets.all(12),
                  child: Text('Close'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
