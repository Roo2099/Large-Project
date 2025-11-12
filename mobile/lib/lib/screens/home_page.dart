import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/skill_chip.dart';
import '../widgets/nav_bar.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Simple data model the real home page can map onto the existing UI widgets.
class RecommendedUser {
  const RecommendedUser({
    required this.userId,
    required this.displayName,
    required this.offerSkills,
    required this.needSkills,
  });

  final int userId;
  final String displayName;
  final List<String> offerSkills;
  final List<String> needSkills;

  RecommendedUser copyWithName(String name) {
    return RecommendedUser(
      userId: userId,
      displayName: name,
      offerSkills: offerSkills,
      needSkills: needSkills,
    );
  }

  String get primarySkill {
    if (offerSkills.isNotEmpty) {
      return offerSkills.first;
    }
    if (needSkills.isNotEmpty) {
      return needSkills.first;
    }
    return 'Skill swapper';
  }

  List<String> get secondaryTags {
    final List<String> tags = <String>[];
    if (offerSkills.length > 1) {
      tags.add('Offers ${offerSkills.length} skills');
    }
    if (needSkills.isNotEmpty) {
      tags.add('Needs ${needSkills.length}');
    }
    return tags;
  }
}

enum RecommendationSource { matches, browse }

/// Prototype home screen that pulls live data.
class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  static const bool _debugLogs = true;
  final TextEditingController _searchController = TextEditingController();
  final List<RecommendedUser> _allUsers = <RecommendedUser>[];
  final List<RecommendedUser> _visibleUsers = <RecommendedUser>[];
  final List<RecommendedUser> _matchedUsers = <RecommendedUser>[];

  bool _isLoading = false;
  String? _errorMessage;
  RecommendationSource _source = RecommendationSource.matches;
  late Future<void> _initialLoad;

  @override
  void initState() {
    super.initState();
    _initialLoad = _loadRecommendations();
    _searchController.addListener(() => _applyFilter(_searchController.text));
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadRecommendations() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      // Show every user: build the full user list and enrich with skills.
      
      final int currentUserId = await _readCurrentUserId();
      final List<dynamic> allUserRecords = await ApiService.fetchUsers();
      final Map<int, String> allNames = _buildNameMap(allUserRecords);
      final Set<int> allIds = allNames.keys
          .where((int id) => id != currentUserId && id != -1)
          .toSet();

      final List<dynamic> browseRaw = await ApiService.fetchBrowseSkills();
      final Map<int, List<String>> offersIdx = <int, List<String>>{};
      final Map<int, List<String>> needsIdx = <int, List<String>>{};
      for (final dynamic raw in browseRaw) {
        if (raw is! Map<String, dynamic>) continue;
        final Object? idValue = raw['UserId'] ?? raw['UserID'];
        final int? uid = idValue is int ? idValue : int.tryParse(idValue?.toString() ?? '');
        if (uid == null || uid == currentUserId || uid == -1) continue;
        final String skillName = (raw['SkillName'] ?? '').toString();
        if (skillName.isEmpty) continue;
        final String type = (raw['Type'] ?? '').toString().toLowerCase();
        final Map<int, List<String>> bucket = type == 'need' ? needsIdx : offersIdx;
        bucket.putIfAbsent(uid, () => <String>[]);
        if (!bucket[uid]!.contains(skillName)) {
          bucket[uid]!.add(skillName);
        }
      }

      final List<RecommendedUser> everyone = allIds
          .map(
            (int id) => RecommendedUser(
              userId: id,
              displayName: allNames[id] ?? 'User $id',
              offerSkills: List<String>.from(offersIdx[id] ?? <String>[]),
              needSkills: List<String>.from(needsIdx[id] ?? <String>[]),
            ),
          )
          .toList();

      final Set<String> myOffers = await _fetchMyOfferSkills();
      final Set<String> myNeeds = await _fetchMyNeedSkills();
      final Set<String> myOffersLc = myOffers.map((String s) => s.trim().toLowerCase()).toSet();
      final Set<String> myNeedsLc = myNeeds.map((String s) => s.trim().toLowerCase()).toSet();

      final List<RecommendedUser> matched = everyone.where((RecommendedUser u) {
        final Iterable<String> theirOffersLc = u.offerSkills.map((String s) => s.trim().toLowerCase());
        final Iterable<String> theirNeedsLc = u.needSkills.map((String s) => s.trim().toLowerCase());
        final bool iWantTheyOffer = theirOffersLc.any((String s) => myNeedsLc.contains(s));
        final bool iOfferTheyWant = theirNeedsLc.any((String s) => myOffersLc.contains(s));
        return iWantTheyOffer || iOfferTheyWant;
      }).toList();

      _matchedUsers
        ..clear()
        ..addAll(matched);

      _allUsers
        ..clear()
        ..addAll(everyone);
      _visibleUsers
        ..clear()
        ..addAll(everyone);

      setState(() {
        _isLoading = false;
        _source = RecommendationSource.browse;
      });
      _applyFilter(_searchController.text);
      
      
      return;
      {
      final int currentUserId = await _readCurrentUserId();
      final Set<String> myOfferSkills = await _fetchMyOfferSkills();
      final Set<String> myOfferSkillsLc =
          myOfferSkills.map((String s) => s.trim().toLowerCase()).toSet();
      if (_debugLogs) {
        print('[Home] My offers (${myOfferSkills.length}): $myOfferSkills');
      }

      // Primary: browse skills and intersect Needs with my Offers
      final List<dynamic> browseRaw = await ApiService.fetchBrowseSkills();
      List<RecommendedUser> users = _mapBrowseResults(browseRaw, currentUserId);
      RecommendationSource source = RecommendationSource.browse;
      if (_debugLogs) {
        print('[Home] Browse mapped users: ${users.length}');
      }

      if (myOfferSkillsLc.isNotEmpty) {
        users = users
            .where((RecommendedUser u) => u.needSkills.any(
                (String s) => myOfferSkillsLc.contains(s.trim().toLowerCase())))
            .toList();
        if (_debugLogs) {
          print('[Home] After need∩offer filter: ${users.length}');
        }
      } else if (users.isEmpty) {
        // Fallback: if no offers or no browse results, show server-provided matches
        final List<dynamic> matchRaw = await ApiService.fetchMatchSkills();
        users = _mapMatchResults(matchRaw, currentUserId);
        source = RecommendationSource.matches;
        if (_debugLogs) {
          print('[Home] Fallback to matches: ${users.length}');
        }
      }

      if (users.isEmpty) {
        _allUsers
          ..clear()
          ..addAll(<RecommendedUser>[]);
        _visibleUsers
          ..clear()
          ..addAll(<RecommendedUser>[]);
        setState(() {
          _isLoading = false;
          _source = source;
        });
        return;
      }

      final List<dynamic> userRecords = await ApiService.fetchUsers();
      final Map<int, String> nameLookup = _buildNameMap(userRecords);
      if (_debugLogs) {
        print('[Home] Loaded ${nameLookup.length} user names');
      }
      final List<RecommendedUser> resolved = users
          .map(
            (RecommendedUser user) => user.copyWithName(
              nameLookup[user.userId] ?? 'User ${user.userId}',
            ),
          )
          .toList();

      _allUsers
        ..clear()
        ..addAll(resolved);
      _visibleUsers
        ..clear()
        ..addAll(resolved);

      setState(() {
        _isLoading = false;
        _source = source;
      });
      _applyFilter(_searchController.text);
      }
    } catch (error) {
      setState(() {
        _isLoading = false;
        _errorMessage = 'Failed to load recommendations: $error';
      });
    }
  }

  Future<int> _readCurrentUserId() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final String? stored = prefs.getString('userId');
    if (stored == null) {
      return -1;
    }
    return int.tryParse(stored) ?? -1;
  }

  Map<int, String> _buildNameMap(List<dynamic> records) {
    final Map<int, String> result = <int, String>{};
    for (final dynamic raw in records) {
      if (raw is! Map<String, dynamic>) {
        continue;
      }
      final Object? idValue = raw['UserID'];
      final int? userId = idValue is int
          ? idValue
          : int.tryParse(idValue?.toString() ?? '');
      if (userId == null) {
        continue;
      }
      final String first = raw['FirstName']?.toString() ?? '';
      final String last = raw['LastName']?.toString() ?? '';
      final String name = '$first $last'.trim();
      result[userId] = name.isEmpty ? 'User $userId' : name;
    }
    return result;
  }

  List<RecommendedUser> _mapMatchResults(
    List<dynamic> payload,
    int currentUser,
  ) {
    final List<RecommendedUser> users = <RecommendedUser>[];
    for (final dynamic raw in payload) {
      if (raw is! Map<String, dynamic>) {
        continue;
      }
      final Object? idValue = raw['_id'];
      final int? userId = idValue is int
          ? idValue
          : int.tryParse(idValue?.toString() ?? '');
      if (userId == null || userId == currentUser || userId == -1) {
        continue;
      }
      final List<dynamic>? skillList = raw['skills'] as List<dynamic>?;
      final List<String> skills = skillList == null
          ? <String>[]
          : skillList.map((dynamic item) => item.toString()).toSet().toList();
      users.add(
        RecommendedUser(
          userId: userId,
          displayName: 'User $userId',
          // For match results, treat returned skills as the user's offers; backend already matches appropriately
          offerSkills: skills,
          needSkills: const <String>[],
        ),
      );
    }
    return users;
  }

  

  List<RecommendedUser> _mapBrowseResults(
    List<dynamic> payload,
    int currentUser,
  ) {
    final Map<int, List<String>> offers = <int, List<String>>{};
    final Map<int, List<String>> needs = <int, List<String>>{};

    for (final dynamic raw in payload) {
      if (raw is! Map<String, dynamic>) {
        continue;
      }
      final Object? idValue = raw['UserId'] ?? raw['UserID'];
      final int? userId = idValue is int
          ? idValue
          : int.tryParse(idValue?.toString() ?? '');
      if (userId == null || userId == currentUser || userId == -1) {
        continue;
      }

      final String skillName = raw['SkillName']?.toString() ?? '';
      if (skillName.isEmpty) {
        continue;
      }

      final String type = raw['Type']?.toString().toLowerCase() ?? 'offer';
      final Map<int, List<String>> bucket = type == 'need' ? needs : offers;
      bucket.putIfAbsent(userId, () => <String>[]);
      if (!bucket[userId]!.contains(skillName)) {
        bucket[userId]!.add(skillName);
      }
    }

    final Set<int> allUserIds = <int>{...offers.keys, ...needs.keys};
    final List<RecommendedUser> users = <RecommendedUser>[];
    for (final int userId in allUserIds) {
      users.add(
        RecommendedUser(
          userId: userId,
          displayName: 'User $userId',
          offerSkills: List<String>.from(offers[userId] ?? <String>[]),
          needSkills: List<String>.from(needs[userId] ?? <String>[]),
        ),
      );
    }
    return users;
  }

  void _applyFilter(String query) {
    final String trimmed = query.trim().toLowerCase();
    if (trimmed.isEmpty) {
      _visibleUsers
        ..clear()
        ..addAll(_matchedUsers);
      setState(() {});
      return;
    }

    final List<RecommendedUser> filtered = _allUsers.where((RecommendedUser user) {
      final bool matchesName = user.displayName.toLowerCase().contains(trimmed);
      final bool matchesOffer = user.offerSkills.any(
        (String s) => s.toLowerCase().contains(trimmed),
      );
      final bool matchesNeed = user.needSkills.any(
        (String s) => s.toLowerCase().contains(trimmed),
      );
      return matchesName || matchesOffer || matchesNeed;
    }).toList();

    _visibleUsers
      ..clear()
      ..addAll(filtered);
    setState(() {});
  }

  Future<Set<String>> _fetchMyOfferSkills() async {
    final List<dynamic> raw = await ApiService.getSkills();
    final Set<String> offers = <String>{};
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
      if (type != 'need' && type != 'looking') {
        offers.add(name);
      }
    }
    return offers;
  }

  Future<Set<String>> _fetchMyNeedSkills() async {
    final List<dynamic> raw = await ApiService.getSkills();
    final Set<String> needs = <String>{};
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
        needs.add(name);
      }
    }
    return needs;
  }

  @override
  
  Future<void> _openOfferDialog(BuildContext context, RecommendedUser user) async {
    final ThemeData theme = Theme.of(context);
    final List<String> myOffers = (await _fetchMyOfferSkills()).toList()..sort();
    final Set<String> myNeedsSet = await _fetchMyNeedSkills();
    final List<String> myNeeds = myNeedsSet.toList()..sort();
    String? selOffer = myOffers.isNotEmpty ? myOffers.first : null;
    String? selNeed = myNeeds.isNotEmpty ? myNeeds.first : null;

    if (!context.mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (BuildContext ctx) {
        return Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
            left: 16,
            right: 16,
            top: 16,
          ),
          child: StatefulBuilder(
            builder: (BuildContext context, StateSetter setModalState) {
              return Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text('Send offer to ' + user.displayName, style: theme.textTheme.titleMedium),
                  const SizedBox(height: 12),
                  Text('You can offer', style: theme.textTheme.bodySmall),
                  const SizedBox(height: 6),
                  DropdownButton<String>(
                    isExpanded: true,
                    value: selOffer,
                    hint: const Text('Select a skill you offer'),
                    items: myOffers.map((String s) => DropdownMenuItem<String>(value: s, child: Text(s))).toList(),
                    onChanged: (String? v) => setModalState(() => selOffer = v),
                  ),
                  const SizedBox(height: 12),
                  Text('You are looking for', style: theme.textTheme.bodySmall),
                  const SizedBox(height: 6),
                  DropdownButton<String>(
                    isExpanded: true,
                    value: selNeed,
                    hint: const Text('Select a skill you need'),
                    items: myNeeds.map((String s) => DropdownMenuItem<String>(value: s, child: Text(s))).toList(),
                    onChanged: (String? v) => setModalState(() => selNeed = v),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: <Widget>[
                      TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
                      const SizedBox(width: 8),
                      ElevatedButton.icon(
                        onPressed: (selOffer == null && selNeed == null)
                            ? null
                            : () async {
                                final Map<String, dynamic> res = await ApiService.sendOffer(
                                  to: user.userId,
                                  offerSkill: selOffer,
                                  needSkill: selNeed,
                                );
                                if (!mounted) return;
                                if (res['error'] != null) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text('Failed to send offer: ' + res['error'].toString())),
                                  );
                                } else {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Offer sent')),
                                  );
                                  Navigator.pop(ctx);
                                }
                              },
                        icon: const Icon(Icons.send, size: 18),
                        label: const Text('Send Offer'),
                      ),
                    ],
                  ),
                ],
              );
            },
          ),
        );
      },
    );
  }
  Future<void> _sendOfferQuick(BuildContext context, RecommendedUser user) async {
    try {
      final Map<String, dynamic> res = await ApiService.sendOffer(to: user.userId);
      if (!mounted) return;
      if (res['error'] != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to send offer: ' + res['error'].toString()), duration: const Duration(seconds: 3)),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Offer sent'), duration: Duration(seconds: 2)),
        );
        // Mark offers for refresh so when user opens Offers tab it is up to date
        final SharedPreferences prefs = await SharedPreferences.getInstance();
        await prefs.setBool('offersRefreshRequested', true);
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to send offer: ' + e.toString()), duration: const Duration(seconds: 3)),
      );
    }
  }Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 72,
        title: Row(
          children: <Widget>[
            Container(
              height: 44,
              width: 44,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Padding(
                padding: const EdgeInsets.all(6),
                child: SvgPicture.asset(
                  'assets/tsx_svgs/SkillSwap.svg',
                  fit: BoxFit.contain,
                ),
              ),
            ),
            const SizedBox(width: 16),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  'SkillSwap',
                  style: theme.textTheme.titleLarge?.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  'Dashboard',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: <Widget>[
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: TextButton.icon(
              onPressed: _isLoading ? null : () => _loadRecommendations(),
              icon: const Icon(Icons.refresh, size: 18),
              label: const Text('Refresh'),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: FutureBuilder<void>(
          future: _initialLoad,
          builder: (BuildContext context, AsyncSnapshot<void> snapshot) {
            if (_isLoading) {
              return const _DashboardLoading();
            }

            if (_errorMessage != null) {
              return _ErrorState(
                message: _errorMessage!,
                onRetry: _loadRecommendations,
              );
            }

            final List<Widget> sections = <Widget>[
              _DashboardIntro(source: _source),
              _SearchPanel(
                controller: _searchController,
                onClear: () {
                  _searchController.clear();
                  _applyFilter('');
                },
              ),
            ];

            if (_source == RecommendationSource.browse) {
              sections.add(const _BrowseBanner());
            }

            if (_visibleUsers.isEmpty) {
              sections.add(
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        'No results',
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Try a different search or clear the query.',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            } else {
              sections.addAll(
                _visibleUsers.map(
                  (RecommendedUser user) => _RecommendationCard(
                    user: user,
                    onSendOffer: (RecommendedUser u) => _sendOfferQuick(context, u),
                  ),
                ),
              );
            }

            return RefreshIndicator(
              color: AppColors.primary,
              onRefresh: _loadRecommendations,
              child: ListView.separated(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
                itemBuilder: (BuildContext context, int index) =>
                    sections[index],
                separatorBuilder: (BuildContext context, int index) =>
                    const SizedBox(height: 16),
                itemCount: sections.length,
              ),
            );
          },
        ),
      ),
    );
  }
}

class _RecommendationCard extends StatelessWidget {
  const _RecommendationCard({required this.user, required this.onSendOffer});

  final RecommendedUser user;
  final void Function(RecommendedUser user) onSendOffer;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final List<String> offerSkills = user.offerSkills.take(3).toList();
    final List<String> needSkills = user.needSkills.take(3).toList();
    final int totalDisplayed = offerSkills.length + needSkills.length;
    final int totalAvailable = user.offerSkills.length + user.needSkills.length;
    final int remaining = totalAvailable - totalDisplayed;

    final SkillChipType primaryType = user.offerSkills.isNotEmpty
        ? SkillChipType.offer
        : (user.needSkills.isNotEmpty
              ? SkillChipType.need
              : SkillChipType.neutral);

    return Container(
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.border),
        boxShadow: <BoxShadow>[
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 20,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                CircleAvatar(
                  radius: 26,
                  backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                  child: Text(
                    user.displayName.isNotEmpty ? user.displayName[0] : '?',
                    style: theme.textTheme.titleMedium?.copyWith(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        user.displayName,
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if (user.secondaryTags.isNotEmpty) ...<Widget>[
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 6,
                          runSpacing: 4,
                          children: user.secondaryTags
                              .map(
                                (String tag) => SkillChip(
                                  label: tag,
                                  type: SkillChipType.neutral,
                                ),
                              )
                              .toList(),
                        ),
                      ],
                    ],
                  ),
                ),
                OutlinedButton.icon(
                  onPressed: () => onSendOffer(user),
                  icon: const Icon(Icons.handshake_outlined, size: 18),
                  label: const Text('Send Offer'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (offerSkills.isNotEmpty)
              _SkillSection(
                title: 'Offering',
                skills: offerSkills,
                type: SkillChipType.offer,
              ),
            if (needSkills.isNotEmpty) ...<Widget>[
              if (offerSkills.isNotEmpty) const SizedBox(height: 12),
              _SkillSection(
                title: 'Looking for',
                skills: needSkills,
                type: SkillChipType.need,
              ),
            ],
            if (remaining > 0) ...<Widget>[
              const SizedBox(height: 12),
              SkillChip(
                label: '+$remaining more',
                type: SkillChipType.neutral,
                icon: Icons.more_horiz,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _SkillSection extends StatelessWidget {
  const _SkillSection({
    required this.title,
    required this.skills,
    required this.type,
  });

  final String title;
  final List<String> skills;
  final SkillChipType type;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          title,
          style: theme.textTheme.bodySmall?.copyWith(
            fontWeight: FontWeight.w600,
            color: AppColors.textSecondary,
            letterSpacing: 0.2,
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 6,
          children: skills
              .map((String skill) => SkillChip(label: skill, type: type))
              .toList(),
        ),
      ],
    );
  }
}

class _DashboardIntro extends StatelessWidget {
  const _DashboardIntro({required this.source});

  final RecommendationSource source;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final bool isMatches = source == RecommendationSource.matches;
    final String headline = isMatches
        ? 'Matches for you'
        : 'Browse the community';
    final String subtitle = isMatches
        ? 'Connect with people who complement your skills.'
        : 'Add more skills to unlock tailored matches.';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          headline,
          style: theme.textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          subtitle,
          style: theme.textTheme.bodyMedium?.copyWith(
            color: AppColors.textSecondary,
          ),
        ),
      ],
    );
  }
}

class _SearchPanel extends StatelessWidget {
  const _SearchPanel({required this.controller, required this.onClear});

  final TextEditingController controller;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border),
        boxShadow: <BoxShadow>[
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: TextField(
          controller: controller,
          decoration: InputDecoration(
            labelText: 'Search people or skills',
            hintText: 'e.g. Jane or React',
            prefixIcon: const Icon(Icons.search),
            suffixIcon: controller.text.isNotEmpty
                ? IconButton(onPressed: onClear, icon: const Icon(Icons.close))
                : null,
          ),
        ),
      ),
    );
  }
}

class _BrowseBanner extends StatelessWidget {
  const _BrowseBanner();

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.accentBlueLight,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFB9CEFB)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          const Icon(Icons.info_outline, color: AppColors.accentBlue),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  'Showing browse results',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: AppColors.accentBlue,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Add or update your skills to unlock personalised matches.',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DashboardLoading extends StatelessWidget {
  const _DashboardLoading();

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          const CircularProgressIndicator(color: AppColors.primary),
          const SizedBox(height: 16),
          Text(
            'Getting your matches...',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Center(
      child: Container(
        constraints: const BoxConstraints(maxWidth: 360),
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: theme.colorScheme.surface,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: AppColors.border),
          boxShadow: <BoxShadow>[
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 18,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(
              Icons.warning_amber_rounded,
              size: 36,
              color: theme.colorScheme.error,
            ),
            const SizedBox(height: 12),
            Text(
              'We ran into a problem',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Try again'),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.headline, required this.onRefresh});

  final String headline;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Center(
      child: Container(
        constraints: const BoxConstraints(maxWidth: 360),
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: theme.colorScheme.surface,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: AppColors.border),
          boxShadow: <BoxShadow>[
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 18,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: <Widget>[
            Container(
              height: 48,
              width: 48,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(
                Icons.people_outline,
                color: AppColors.primary,
                size: 26,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              headline,
              textAlign: TextAlign.center,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Add a skill or search for people to start matching.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: onRefresh,
              icon: const Icon(Icons.refresh),
              label: const Text('Refresh'),
            ),
          ],
        ),
      ),
    );
  }
}



