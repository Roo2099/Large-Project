import 'package:flutter/material.dart';
import 'dart:async';
import 'package:shared_preferences/shared_preferences.dart';

import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/nav_bar.dart';

class OffersPage extends StatefulWidget {
  const OffersPage({super.key});

  @override
  State<OffersPage> createState() => _OffersPageState();
}

class _OffersPageState extends State<OffersPage> with SingleTickerProviderStateMixin {
  late final TabController _controller;
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _incoming = <Map<String, dynamic>>[];
  List<Map<String, dynamic>> _outgoing = <Map<String, dynamic>>[];
  String? _offersToken;
  Timer? _refreshTimer;
  bool _refreshing = false;

  @override
  void initState() {
    super.initState();
    _controller = TabController(length: 2, vsync: this);
    _load();
    _startAutoRefresh();
  }

  Future<void> _load({bool silent = false}) async {
    if (_refreshing) return;
    _refreshing = true;
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final SharedPreferences prefs = await SharedPreferences.getInstance();
      final int myId = int.tryParse(prefs.getString('userId') ?? '') ?? -1;

      // Load offers from API
      final List<Map<String, dynamic>> incoming = await ApiService.fetchIncomingOffers();
      final List<Map<String, dynamic>> outgoing = await ApiService.fetchOutgoingOffers();

      final String newToken = _computeOffersToken(incoming, outgoing);
      if (_offersToken != null && _offersToken == newToken) {
        if (!silent) {
          setState(() { _loading = false; });
        }
        _refreshing = false;
        return;
      }

      setState(() {
        _incoming = incoming;
        _outgoing = outgoing;
        _offersToken = newToken;
        _loading = false;
      });
    } catch (e) {
      if (!silent) {
        setState(() {
          _loading = false;
          _error = 'Failed to load offers: $e';
        });
      }
    }
    _refreshing = false;
  }

  Future<void> refreshIfRequested() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final bool needs = prefs.getBool('offersRefreshRequested') ?? false;
    if (needs) {
      await _load();
      await prefs.remove('offersRefreshRequested');
    }
  }

  Future<void> _respond(String id, bool accept) async {
    final String action = accept ? 'accept' : 'decline';
    try {
      final Map<String, dynamic> res = await ApiService.respondOffer(id: id, accept: accept);
      if (res['error'] != null) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to $action offer: ${res['error']}')),
        );
        return;
      }
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Offer ${accept ? 'accepted' : 'declined'}')),
      );
      if (accept) {
        // Jump to Messages and refresh
        await Future<void>.delayed(const Duration(milliseconds: 250));
        if (!mounted) return;
        Navigator.pushReplacementNamed(context, '/messages');
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to $action offer: $e')),
      );
    }
  }

  Future<void> _acceptAndOpen(Map<String, dynamic> row) async {
    final String id = row['id']?.toString() ?? '';
    if (id.isEmpty) return;
    final Map<String, dynamic> res = await ApiService.respondOffer(id: id, accept: true);
    if (!mounted) return;
    if (res['error'] != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to accept offer: ${res['error']}')),
      );
      return;
    }
    // Determine partner
    int? partnerId = int.tryParse((row['fromUserId'] ?? row['from']).toString());
    final Map<String, dynamic>? other = row['other'] is Map<String, dynamic>
        ? Map<String, dynamic>.from(row['other'] as Map)
        : null;
    final String partnerName = other != null
        ? ('${other['firstName'] ?? ''} ${other['lastName'] ?? ''}').trim()
        : 'User';
    // Navigate to Messages and open chat
    Navigator.pushReplacement(
      context,
      MaterialPageRoute<Widget>(
        builder: (BuildContext context) => NavBar(
          initialIndex: 2,
          messagesInitialPartnerId: partnerId,
          messagesInitialPartnerName: partnerName.isEmpty ? 'User' : partnerName,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Offers'),
        actions: <Widget>[
          IconButton(
            tooltip: 'Refresh',
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
        bottom: TabBar(controller: _controller, tabs: const <Tab>[
          Tab(text: 'Incoming'),
          Tab(text: 'Outgoing'),
        ]),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      Text(_error!, style: theme.textTheme.bodyMedium),
                      const SizedBox(height: 8),
                      ElevatedButton(
                        onPressed: _load,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : TabBarView(
                  controller: _controller,
                  children: <Widget>[
                    _OfferList(
                      rows: _incoming,
                      onAcceptRow: (Map<String, dynamic> row) => _acceptAndOpen(row),
                      onDecline: (String id) => _respond(id, false),
                    ),
                    _OfferList(
                      rows: _outgoing,
                      onCancel: (String id) => _cancel(id),
                    ),
                  ],
                ),
    );
  }

  void _startAutoRefresh() {
    _refreshTimer?.cancel();
    _refreshTimer = Timer.periodic(const Duration(milliseconds: 500), (_) {
      if (!_loading) {
        _load(silent: true);
      }
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  String _computeOffersToken(List<Map<String, dynamic>> incoming, List<Map<String, dynamic>> outgoing) {
    final List<String> items = <String>[];
    for (final Map<String, dynamic> r in incoming) {
      items.add('${r['id']}:${r['status']}');
    }
    for (final Map<String, dynamic> r in outgoing) {
      items.add('${r['id']}:${r['status']}');
    }
    items.sort();
    return items.join('|');
  }

}

class _OfferList extends StatelessWidget {
  const _OfferList({
    required this.rows,
    this.nameLookup,
    this.onAcceptRow,
    this.onDecline,
    this.onCancel,
  });

  final List<Map<String, dynamic>> rows;
  final Map<int, String>? nameLookup;
  final void Function(Map<String, dynamic> row)? onAcceptRow;
  final void Function(String id)? onDecline;
  final void Function(String id)? onCancel;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    if (rows.isEmpty) {
      return Center(
        child: Text('No offers', style: theme.textTheme.bodyMedium),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: rows.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (BuildContext context, int index) {
        final Map<String, dynamic> row = rows[index];
        final Map<String, dynamic>? other = row['other'] is Map<String, dynamic>
            ? Map<String, dynamic>.from(row['other'] as Map)
            : null;
        final int from = int.tryParse((row['fromUserId'] ?? row['from']).toString()) ?? -1;
        final int to = int.tryParse((row['toUserId'] ?? row['to']).toString()) ?? -1;
        final String otherName = other != null
            ? ('${other['firstName'] ?? ''} ${other['lastName'] ?? ''}').trim()
            : '';
        final String title = otherName.isNotEmpty
            ? otherName
            : (nameLookup != null ? (nameLookup![from] ?? nameLookup![to] ?? 'User') : 'User');
        final String status = (row['status'] ?? 'pending').toString();
        // Build subtitle from 'other.skills' if present
        final List<dynamic> rawSkills = (other != null && other['skills'] is List)
            ? List<dynamic>.from(other['skills'] as List)
            : const <dynamic>[];
        final List<String> offerSkills = <String>[];
        final List<String> needSkills = <String>[];
        for (final dynamic s in rawSkills) {
          if (s is Map<String, dynamic>) {
            final String name = (s['SkillName'] ?? '').toString();
            final String type = (s['Type'] ?? '').toString().toLowerCase();
            if (name.isEmpty) continue;
            if (type == 'need') {
              needSkills.add(name);
            } else {
              offerSkills.add(name);
            }
          }
        }
        final String subtitle = 'Offering: '
                '${offerSkills.isEmpty ? '-' : offerSkills.take(3).join(', ')}'
            ' · Looking for: '
                '${needSkills.isEmpty ? '-' : needSkills.take(3).join(', ')}';
        final bool canAct = onAcceptRow != null && onDecline != null && status == 'pending';
        final bool canCancel = onCancel != null && status == 'pending';
        return Container(
          decoration: BoxDecoration(
            color: theme.colorScheme.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border),
          ),
          child: ListTile(
            title: Text(title),
            subtitle: Text(subtitle),
            trailing: canAct
                ? Wrap(
                    spacing: 8,
                    children: <Widget>[
                      IconButton(
                        tooltip: 'Decline',
                        onPressed: () => onDecline!(row['id'].toString()),
                        icon: const Icon(Icons.close, color: Colors.redAccent),
                      ),
                      IconButton(
                        tooltip: 'Accept',
                        onPressed: () => onAcceptRow!(row),
                        icon: const Icon(Icons.check, color: Colors.green),
                      ),
                    ],
                  )
                : canCancel
                    ? TextButton.icon(
                        onPressed: () => onCancel!(row['id'].toString()),
                        icon: const Icon(Icons.cancel_outlined),
                        label: const Text('Cancel'),
                      )
                    : Text(status, style: theme.textTheme.bodySmall),
          ),
        );
      },
    );
  }
}

extension on _OffersPageState {
  Future<void> _cancel(String id) async {
    try {
      final bool ok = await ApiService.cancelOffer(id);
      if (!mounted) return;
      if (ok) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Offer canceled'), duration: Duration(seconds: 2)),
        );
        await _load();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to cancel offer'), duration: Duration(seconds: 3)),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to cancel offer: ' + e.toString()), duration: const Duration(seconds: 3)),
      );
    }
  }
}
