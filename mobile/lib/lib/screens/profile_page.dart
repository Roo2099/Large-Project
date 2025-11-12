import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../services/api_service.dart';
import '../theme/app_theme.dart';
import 'add_skill_page.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  final TextEditingController _firstNameController = TextEditingController();
  final TextEditingController _lastNameController = TextEditingController();

  bool _savingName = false;
  bool _loadingSkills = true;
  String? _message;

  final List<String> _offerSkills = <String>[];
  final List<String> _needSkills = <String>[];

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    _firstNameController.text = prefs.getString('firstName') ?? '';
    _lastNameController.text = prefs.getString('lastName') ?? '';

    // Also attempt to refresh name from API if available
    final Map<String, dynamic>? me = await ApiService.fetchMyUser();
    if (me != null) {
      final String fn = me['firstName']?.toString() ?? _firstNameController.text;
      final String ln = me['lastName']?.toString() ?? _lastNameController.text;
      if (mounted) {
        setState(() {
          _firstNameController.text = fn;
          _lastNameController.text = ln;
        });
      }
    }

    await _refreshSkills();
  }

  Future<void> _refreshSkills() async {
    setState(() {
      _loadingSkills = true;
      _offerSkills.clear();
      _needSkills.clear();
    });

    final List<dynamic> raw = await ApiService.getSkills();

    for (final dynamic item in raw) {
      String name = '';
      String type = '';

      if (item is Map<String, dynamic>) {
        name = (item['SkillName'] ?? item['skill'] ?? item['name'] ?? item['card'] ?? '').toString();
        type = (item['Type'] ?? item['type'] ?? '').toString().toLowerCase();
      } else if (item is String) {
        name = item;
      } else {
        name = item.toString();
      }

      if (name.trim().isEmpty) continue;

      if (type == 'need' || type == 'looking') {
        if (!_needSkills.contains(name)) _needSkills.add(name);
      } else {
        if (!_offerSkills.contains(name)) _offerSkills.add(name);
      }
    }

    setState(() {
      _loadingSkills = false;
    });
  }

  Future<void> _saveName() async {
    FocusScope.of(context).unfocus();
    setState(() {
      _savingName = true;
      _message = null;
    });

    final String first = _firstNameController.text.trim();
    final String last = _lastNameController.text.trim();

    try {
      // Try to persist to backend if available; fall back to local storage.
      final Map<String, dynamic> res = await ApiService.updateProfile(
        firstName: first,
        lastName: last,
      );

      if (res['error'] != null) {
        final SharedPreferences prefs = await SharedPreferences.getInstance();
        await prefs.setString('firstName', first);
        await prefs.setString('lastName', last);
        setState(() {
          _message = 'Saved locally. Server: ${res['error']}';
        });
      } else if (res['warning'] != null) {
        setState(() {
          _message = res['warning'].toString();
        });
      } else {
        setState(() {
          _message = 'Profile updated successfully';
        });
      }
    } catch (e) {
      final SharedPreferences prefs = await SharedPreferences.getInstance();
      await prefs.setString('firstName', first);
      await prefs.setString('lastName', last);
      setState(() {
        _message = 'Saved locally. Error: $e';
      });
    } finally {
      setState(() {
        _savingName = false;
      });
    }
  }

  Future<void> _deleteSkill(String skill) async {
    final Map<String, dynamic> res = await ApiService.deleteSkill(skill);
    if (!mounted) return;

    if (res['error'] != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Delete failed: ${res['error']}')),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Skill removed')),
      );
      await _refreshSkills();
    }
  }

  Future<void> _addSkill() async {
    final bool? changed = await Navigator.push<bool>(
      context,
      MaterialPageRoute<bool>(builder: (_) => const AddSkillPage()),
    );
    if (changed == true) {
      await _refreshSkills();
    }
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        actions: <Widget>[
          IconButton(
            tooltip: 'Sign out',
            icon: const Icon(Icons.logout),
            onPressed: _signOut,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _addSkill,
        icon: const Icon(Icons.add),
        label: const Text('Add skill'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: <Widget>[
            // Card: Basic info + edit name
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: theme.colorScheme.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
                boxShadow: <BoxShadow>[
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 20,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  Text(
                    'Your info',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: <Widget>[
                      Expanded(
                        child: TextField(
                          controller: _firstNameController,
                          textCapitalization: TextCapitalization.words,
                          decoration: const InputDecoration(
                            labelText: 'First name',
                            prefixIcon: Icon(Icons.person_outline),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: _lastNameController,
                          textCapitalization: TextCapitalization.words,
                          decoration: const InputDecoration(
                            labelText: 'Last name',
                            prefixIcon: Icon(Icons.person_outline),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Align(
                    alignment: Alignment.centerRight,
                    child: ElevatedButton.icon(
                      onPressed: _savingName ? null : _saveName,
                      icon: const Icon(Icons.save_outlined),
                      label: Text(_savingName ? 'Saving...' : 'Save changes'),
                    ),
                  ),
                  if (_message != null) ...<Widget>[
                    const SizedBox(height: 8),
                    Text(
                      _message!,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),
            // Card: Skills
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: theme.colorScheme.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
                boxShadow: <BoxShadow>[
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 20,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  Text(
                    'Your skills',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (_loadingSkills)
                    const Center(child: CircularProgressIndicator())
                  else ...<Widget>[
                    _SkillSection(
                      title: 'Offering',
                      items: _offerSkills,
                      onDelete: _deleteSkill,
                    ),
                    const SizedBox(height: 12),
                    _SkillSection(
                      title: 'Looking for',
                      items: _needSkills,
                      onDelete: _deleteSkill,
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _signOut() async {
    try {
      final SharedPreferences prefs = await SharedPreferences.getInstance();
      await prefs.remove('token');
      await prefs.remove('userId');
      await prefs.remove('firstName');
      await prefs.remove('lastName');
      await prefs.remove('userEmail');
      await prefs.remove('userName');
      await prefs.remove('offersRefreshRequested');
    } catch (_) {}
    if (!mounted) return;
    Navigator.pushNamedAndRemoveUntil(context, '/login', (Route<dynamic> r) => false);
  }
}

class _SkillSection extends StatelessWidget {
  const _SkillSection({
    required this.title,
    required this.items,
    required this.onDelete,
  });

  final String title;
  final List<String> items;
  final void Function(String skill) onDelete;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          title,
          style: theme.textTheme.bodyLarge?.copyWith(
            fontWeight: FontWeight.w600,
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 8),
        if (items.isEmpty)
          Text(
            'No skills',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: AppColors.textSecondary,
            ),
          )
        else
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: items
                .map(
                  (String s) => Chip(
                    label: Text(s),
                    onDeleted: () => onDelete(s),
                    deleteIcon: const Icon(Icons.close),
                  ),
                )
                .toList(),
          ),
      ],
    );
  }
}
