import 'package:flutter/material.dart';

import '../services/api_service.dart';
import '../theme/app_theme.dart';

class AddSkillPage extends StatefulWidget {
  const AddSkillPage({super.key});

  @override
  State<AddSkillPage> createState() => _AddSkillPageState();
}

class _AddSkillPageState extends State<AddSkillPage> {
  List<String> _catalog = <String>[];
  String? _selectedSkill;
  String _selectedType = 'offer'; // 'offer' or 'need'

  String message = '';
  bool isLoading = false;
  bool loadingCatalog = true;

  @override
  void initState() {
    super.initState();
    _loadCatalog();
  }

  Future<void> _loadCatalog() async {
    final List<String> items = await ApiService.fetchSkillCatalog();
    setState(() {
      _catalog = items;
      loadingCatalog = false;
    });
  }

  Future<void> handleAddSkill() async {
    FocusScope.of(context).unfocus();

    setState(() {
      isLoading = true;
      message = '';
    });

    final String? skillName = _selectedSkill;
    if (skillName == null || skillName.trim().isEmpty) {
      setState(() {
        message = 'Please select a skill first.';
        isLoading = false;
      });
      return;
    }

    final Map<String, dynamic> result =
        await ApiService.addSkill(skillName, type: _selectedType);

    if (!mounted) {
      return;
    }

    final String feedback = result['error'] ?? 'Skill added successfully!';
    setState(() {
      message = feedback;
      isLoading = false;
    });

    if (!feedback.toLowerCase().contains('error')) {
      Navigator.pop(context, true);
    }
  }

  Future<void> _openSkillPicker() async {
    if (loadingCatalog) return;
    final String? picked = await showDialog<String>(
      context: context,
      builder: (BuildContext context) {
        return _SkillPickerDialog(options: _catalog);
      },
    );
    if (picked != null && picked.isNotEmpty) {
      setState(() {
        _selectedSkill = picked;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Add Skill')),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: theme.colorScheme.surface,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: AppColors.border),
                boxShadow: <BoxShadow>[
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 20,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    Text(
                      'Add a new skill',
                      style: theme.textTheme.headlineSmall?.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Choose a skill from the catalog and mark it as Offering or Looking for.',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 20),
                    Text(
                      'Skill',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: <Widget>[
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: loadingCatalog ? null : _openSkillPicker,
                            icon: const Icon(Icons.search),
                            label: Text(
                              loadingCatalog
                                  ? 'Loading skills...'
                                  : (_selectedSkill ?? 'Select a skill'),
                              overflow: TextOverflow.ellipsis,
                              maxLines: 1,
                            ),
                          ),
                        ),
                        if (_selectedSkill != null) ...<Widget>[
                          const SizedBox(width: 8),
                          IconButton(
                            tooltip: 'Clear',
                            onPressed: () => setState(() => _selectedSkill = null),
                            icon: const Icon(Icons.close),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 20),
                    Text(
                      'Type',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      children: <Widget>[
                        ChoiceChip(
                          label: const Text('Offering'),
                          selected: _selectedType == 'offer',
                          onSelected: (_) => setState(() => _selectedType = 'offer'),
                        ),
                        ChoiceChip(
                          label: const Text('Looking for'),
                          selected: _selectedType == 'need',
                          onSelected: (_) => setState(() => _selectedType = 'need'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: isLoading ? null : handleAddSkill,
                        child: Text(isLoading ? 'Adding...' : 'Add Skill'),
                      ),
                    ),
                    if (message.isNotEmpty) ...<Widget>[
                      const SizedBox(height: 16),
                      Text(
                        message,
                        textAlign: TextAlign.center,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: message.toLowerCase().contains('error')
                              ? theme.colorScheme.error
                              : AppColors.accentGreen,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SkillPickerDialog extends StatefulWidget {
  const _SkillPickerDialog({required this.options});

  final List<String> options;

  @override
  State<_SkillPickerDialog> createState() => _SkillPickerDialogState();
}

class _SkillPickerDialogState extends State<_SkillPickerDialog> {
  late List<String> filtered;
  final TextEditingController _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    filtered = List<String>.from(widget.options);
    _search.addListener(_applyFilter);
  }

  @override
  void dispose() {
    _search.removeListener(_applyFilter);
    _search.dispose();
    super.dispose();
  }

  void _applyFilter() {
    final String q = _search.text.trim().toLowerCase();
    setState(() {
      if (q.isEmpty) {
        filtered = List<String>.from(widget.options);
      } else {
        filtered = widget.options
            .where((String s) => s.toLowerCase().contains(q))
            .toList(growable: false);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520, maxHeight: 600),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: TextField(
                controller: _search,
                decoration: const InputDecoration(
                  hintText: 'Search skills...',
                  prefixIcon: Icon(Icons.search),
                ),
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView.builder(
                itemCount: filtered.length,
                itemBuilder: (BuildContext context, int index) {
                  final String name = filtered[index];
                  return ListTile(
                    title: Text(name),
                    onTap: () => Navigator.pop(context, name),
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
                  child: Text('Cancel'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
