import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static const String baseUrl = 'https://poosd24.live/api';

  static Future<Map<String, dynamic>> login(
    String login,
    String password,
  ) async {
    final Map<String, dynamic> result = await _post('/login', <String, dynamic>{
      'login': login.trim(),
      'password': password.trim(),
    });

    final String? token = result['token']?.toString();
    if (token != null && token.isNotEmpty) {
      final SharedPreferences prefs = await SharedPreferences.getInstance();
      await prefs.setString('token', token);

      final Object? id = result['id'];
      if (id != null) {
        await prefs.setString('userId', id.toString());
      }

      final Object? firstName = result['firstName'];
      if (firstName != null) {
        await prefs.setString('firstName', firstName.toString());
      }

      final Object? lastName = result['lastName'];
      if (lastName != null) {
        await prefs.setString('lastName', lastName.toString());
      }
    }

    return result;
  }

  static Future<Map<String, dynamic>> register(
    String name,
    String email,
    String password,
  ) async {
    final List<String> nameParts = name.trim().split(RegExp(r'\s+'));
    final String firstName = nameParts.isNotEmpty ? nameParts.first : '';
    final String lastName = nameParts.length > 1
        ? nameParts.sublist(1).join(' ')
        : '';

    return _post('/register', <String, dynamic>{
      'firstName': firstName,
      'lastName': lastName,
      'login': email.trim(),
      'password': password.trim(),
    });
  }

  static Future<Map<String, dynamic>> requestPasswordReset(String login) async {
    return _post('/request-reset', <String, dynamic>{'login': login.trim()});
  }

  static Future<List<dynamic>> getSkills() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final String token = prefs.getString('token') ?? '';

    if (token.isEmpty) {
      return <dynamic>[];
    }

    try {
      final http.Response response = await http.get(
        Uri.parse('$baseUrl/myskills'),
        headers: <String, String>{
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      _logResponse('GET /myskills', response);

      if (response.statusCode == 200 && response.body.isNotEmpty) {
        final dynamic decoded = jsonDecode(response.body);
        if (decoded is Map<String, dynamic> && decoded['mySkills'] is List) {
          return List<dynamic>.from(decoded['mySkills'] as List<dynamic>);
        }
      }

      return <dynamic>[];
    } catch (e) {
      print('Network error in getSkills: $e');
      return <dynamic>[];
    }
  }

  static Future<Map<String, dynamic>> addSkill(
    String skill, {
    String type = 'offer',
  }) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final String token = prefs.getString('token') ?? '';

    if (token.isEmpty) {
      return <String, dynamic>{'error': 'Missing authentication token'};
    }

    try {
      final http.Response response = await http.post(
        Uri.parse('$baseUrl/addskill'),
        headers: <String, String>{
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        // Backend requires capitalized keys: SkillName and Type
        body: jsonEncode(<String, String>{
          'SkillName': skill,
          'Type': type,
        }),
      );

      _logResponse('POST /addskill', response);

      if (response.statusCode == 200 && response.body.isNotEmpty) {
        final Map<String, dynamic>? decoded = _decodeMap(response.body);
        if (decoded != null) {
          return decoded;
        }
      }

      return <String, dynamic>{'error': 'Unexpected response from server'};
    } catch (e) {
      print('Network error in addSkill: $e');
      return <String, dynamic>{'error': 'Network error: $e'};
    }
  }

  static Future<Map<String, dynamic>> deleteSkill(String skillName) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final String token = prefs.getString('token') ?? '';

    if (token.isEmpty) {
      return <String, dynamic>{'error': 'Missing authentication token'};
    }

    try {
      final String encoded = Uri.encodeComponent(skillName);
      final http.Response response = await http.delete(
        Uri.parse('$baseUrl/deleteskill/$encoded'),
        headers: <String, String>{
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      _logResponse('DELETE /deleteskill', response);

      if (response.statusCode == 200 && response.body.isNotEmpty) {
        final Map<String, dynamic>? decoded = _decodeMap(response.body);
        if (decoded != null) {
          return decoded;
        }
      }

      return <String, dynamic>{'error': 'Unexpected response from server'};
    } catch (e) {
      print('Network error in deleteSkill: $e');
      return <String, dynamic>{'error': 'Network error: $e'};
    }
  }

  static Future<List<dynamic>> fetchMatchSkills() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final String token = prefs.getString('token') ?? '';

    if (token.isEmpty) {
      return <dynamic>[];
    }

    try {
      final http.Response response = await http.get(
        Uri.parse('$baseUrl/matchskills'),
        headers: <String, String>{
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      _logResponse('GET /matchskills', response);
      final Map<String, dynamic>? decoded = _decodeMap(response.body);

      if (response.statusCode == 200 && decoded != null) {
        final dynamic matches = decoded['matches'];
        if (matches is List<dynamic>) {
          return List<dynamic>.from(matches);
        }
      }

      return <dynamic>[];
    } catch (error) {
      print('Network error in fetchMatchSkills: $error');
      return <dynamic>[];
    }
  }

  static Future<List<dynamic>> fetchBrowseSkills() async {
    try {
      final http.Response response = await http.get(
        Uri.parse('$baseUrl/browseskills'),
        headers: const <String, String>{'Content-Type': 'application/json'},
      );

      _logResponse('GET /browseskills', response);
      final Map<String, dynamic>? decoded = _decodeMap(response.body);

      if (response.statusCode == 200 && decoded != null) {
        final dynamic skills = decoded['skills'];
        if (skills is List<dynamic>) {
          return List<dynamic>.from(skills);
        }
      }

      return <dynamic>[];
    } catch (error) {
      print('Network error in fetchBrowseSkills: $error');
      return <dynamic>[];
    }
  }

  static Future<List<dynamic>> fetchUsers() async {
    try {
      final http.Response response = await http.get(
        Uri.parse('$baseUrl/users'),
        headers: const <String, String>{'Content-Type': 'application/json'},
      );

      _logResponse('GET /users', response);
      final Map<String, dynamic>? decoded = _decodeMap(response.body);

      if (response.statusCode == 200 && decoded != null) {
        final dynamic users = decoded['users'];
        if (users is List<dynamic>) {
          return List<dynamic>.from(users);
        }
      }

      return <dynamic>[];
    } catch (error) {
      print('Network error in fetchUsers: $error');
      return <dynamic>[];
    }
  }

  // Messaging APIs (best-effort with endpoint fallbacks)
  static Future<List<Map<String, dynamic>>> fetchConversations() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final String token = prefs.getString('token') ?? '';
    if (token.isEmpty) return <Map<String, dynamic>>[];
    try {
      http.Response response = await http.get(
        Uri.parse('$baseUrl/conversations'),
        headers: <String, String>{
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );
      _logResponse('GET /conversations', response);
      if (response.statusCode == 404) {
        response = await http.get(
          Uri.parse('$baseUrl/messages/partners'),
          headers: <String, String>{
            'Authorization': 'Bearer $token',
            'Content-Type': 'application/json',
          },
        );
        _logResponse('GET /messages/partners', response);
      }
      if (response.statusCode >= 200 && response.statusCode < 300) {
        final Map<String, dynamic>? decoded = _decodeMap(response.body);
        if (decoded != null) {
          final dynamic list = decoded['conversations'] ?? decoded['partners'];
          if (list is List<dynamic>) {
            return list.map<Map<String, dynamic>>((dynamic e) => _asMap(e)).toList();
          }
        }
        // Some APIs return arrays directly
        final dynamic alt = jsonDecode(response.body);
        if (alt is List) {
          return alt.map<Map<String, dynamic>>((dynamic e) => _asMap(e)).toList();
        }
      }
    } catch (e) {
      print('Network error in fetchConversations: $e');
    }
    return <Map<String, dynamic>>[];
  }

  static Future<List<Map<String, dynamic>>> fetchMessages(int partnerId,
      {int page = 1}) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final String token = prefs.getString('token') ?? '';
    if (token.isEmpty) return <Map<String, dynamic>>[];
    try {
      Uri uri = Uri.parse('$baseUrl/messages?partner=$partnerId&page=$page');
      http.Response response = await http.get(
        uri,
        headers: <String, String>{
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );
      _logResponse('GET /messages?partner', response);
      if (response.statusCode == 404) {
        response = await http.get(
          Uri.parse('$baseUrl/conversation/$partnerId?page=$page'),
          headers: <String, String>{
            'Authorization': 'Bearer $token',
            'Content-Type': 'application/json',
          },
        );
        _logResponse('GET /conversation/:id', response);
      }
      if (response.statusCode >= 200 && response.statusCode < 300) {
        final Map<String, dynamic>? decoded = _decodeMap(response.body);
        if (decoded != null) {
          final dynamic list = decoded['messages'] ?? decoded['data'];
          if (list is List<dynamic>) {
            return list.map<Map<String, dynamic>>((dynamic e) => _asMap(e)).toList();
          }
        }
        final dynamic alt = jsonDecode(response.body);
        if (alt is List) {
          return alt.map<Map<String, dynamic>>((dynamic e) => _asMap(e)).toList();
        }
      }
    } catch (e) {
      print('Network error in fetchMessages: $e');
    }
    return <Map<String, dynamic>>[];
  }

  static Future<List<Map<String, dynamic>>> fetchAllMessages() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final String token = prefs.getString('token') ?? '';
    if (token.isEmpty) return <Map<String, dynamic>>[];
    try {
      final http.Response response = await http.get(
        Uri.parse('$baseUrl/messages'),
        headers: <String, String>{
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      );
      _logResponse('GET /messages', response);
      if (response.statusCode >= 200 && response.statusCode < 300) {
        final Map<String, dynamic>? decoded = _decodeMap(response.body);
        final dynamic list = decoded != null ? decoded['messages'] : null;
        if (list is List<dynamic>) {
          return list.map<Map<String, dynamic>>((dynamic e) => _asMap(e)).toList();
        }
        final dynamic alt = jsonDecode(response.body);
        if (alt is List) {
          return alt.map<Map<String, dynamic>>((dynamic e) => _asMap(e)).toList();
        }
      }
    } catch (e) {
      print('Network error in fetchAllMessages: $e');
    }
    return <Map<String, dynamic>>[];
  }

  static Future<Map<String, dynamic>> sendMessage({
    required int to,
    required String body,
  }) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final String token = prefs.getString('token') ?? '';
    if (token.isEmpty) {
      return <String, dynamic>{'error': 'Missing authentication token'};
    }
    try {
      http.Response response = await http.post(
        Uri.parse('$baseUrl/messages'),
        headers: <String, String>{
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode(<String, dynamic>{'to': to, 'body': body}),
      );
      _logResponse('POST /messages', response);
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return _decodeMap(response.body) ?? <String, dynamic>{'ok': true};
      }
      final Map<String, dynamic>? decoded = _decodeMap(response.body);
      final String message = decoded != null && decoded['error'] != null
          ? decoded['error'].toString()
          : 'Unexpected response from server (${response.statusCode})';
      return <String, dynamic>{'error': message};
    } catch (e) {
      return <String, dynamic>{'error': 'Network error: $e'};
    }
  }

  static Future<bool> deleteMessage(String id) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final String token = prefs.getString('token') ?? '';
    if (token.isEmpty) return false;
    try {
      final http.Response response = await http.delete(
        Uri.parse('$baseUrl/messages/$id'),
        headers: <String, String>{
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
        },
      );
      _logResponse('DELETE /messages/:id', response);
      return response.statusCode >= 200 && response.statusCode < 300;
    } catch (_) {
      return false;
    }
  }

  static Future<List<Map<String, dynamic>>> searchUsers(String name) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final String token = prefs.getString('token') ?? '';
    if (token.isEmpty || name.trim().isEmpty) return <Map<String, dynamic>>[];
    try {
      final String q = Uri.encodeComponent(name.trim());
      final http.Response response = await http.get(
        Uri.parse('$baseUrl/users?name=$q'),
        headers: <String, String>{
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
        },
      );
      _logResponse('GET /users?name=', response);
      if (response.statusCode >= 200 && response.statusCode < 300) {
        final Map<String, dynamic>? decoded = _decodeMap(response.body);
        final dynamic list = decoded != null ? decoded['users'] : null;
        if (list is List<dynamic>) {
          return list.map<Map<String, dynamic>>((dynamic e) => _asMap(e)).toList();
        }
      }
    } catch (e) {
      print('Network error in searchUsers: $e');
    }
    return <Map<String, dynamic>>[];
  }

  // Offers
  static Future<Map<String, dynamic>> sendOffer({
    required int to,
    String? offerSkill, // ignored by current backend
    String? needSkill,  // ignored by current backend
  }) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final String token = prefs.getString('token') ?? '';
    if (token.isEmpty) return <String, dynamic>{'error': 'Missing authentication token'};
    try {
      // Backend expects a friend request to initiate an offer
      final http.Response response = await http.post(
        Uri.parse('$baseUrl/friend-request/$to'),
        headers: <String, String>{
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode(<String, dynamic>{}),
      );
      _logResponse('POST /friend-request/:toUserId', response);
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return _decodeMap(response.body) ?? <String, dynamic>{'ok': true};
      }
      final Map<String, dynamic>? decoded = _decodeMap(response.body);
      final String message = decoded != null && decoded['error'] != null
          ? decoded['error'].toString()
          : 'Unexpected response from server (${response.statusCode})';
      return <String, dynamic>{'error': message};
    } catch (e) {
      return <String, dynamic>{'error': 'Network error: $e'};
    }
  }

  static Future<List<Map<String, dynamic>>> fetchIncomingOffers() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final String token = prefs.getString('token') ?? '';
    if (token.isEmpty) return <Map<String, dynamic>>[];
    try {
      http.Response response = await http.get(
        Uri.parse('$baseUrl/offers/incoming'),
        headers: <String, String>{
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      );
      _logResponse('GET /offers/incoming', response);
      Map<String, dynamic>? decoded = _decodeMap(response.body);
      dynamic list = decoded != null ? (decoded['offers'] ?? decoded['data']) : null;
      if (list is List) {
        return list.map<Map<String, dynamic>>((dynamic e) => _asMap(e)).toList();
      }
      // Fallback to friend-requests (incoming)
      response = await http.get(
        Uri.parse('$baseUrl/friend-requests'),
        headers: <String, String>{
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      );
      _logResponse('GET /friend-requests', response);
      decoded = _decodeMap(response.body);
      list = decoded != null ? (decoded['requests'] ?? decoded['data']) : null;
      if (list is List) {
        return list.map<Map<String, dynamic>>((dynamic e) => _asMap(e)).toList();
      }
      return <Map<String, dynamic>>[];
    } catch (e) {
      return <Map<String, dynamic>>[];
    }
  }

  static Future<List<Map<String, dynamic>>> fetchOutgoingOffers() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final String token = prefs.getString('token') ?? '';
    if (token.isEmpty) return <Map<String, dynamic>>[];
    try {
      http.Response response = await http.get(
        Uri.parse('$baseUrl/offers/outgoing'),
        headers: <String, String>{
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      );
      _logResponse('GET /offers/outgoing', response);
      Map<String, dynamic>? decoded = _decodeMap(response.body);
      dynamic list = decoded != null ? (decoded['offers'] ?? decoded['data']) : null;
      if (list is List) {
        return list.map<Map<String, dynamic>>((dynamic e) => _asMap(e)).toList();
      }
      // Fallback to outgoing friend-requests
      response = await http.get(
        Uri.parse('$baseUrl/friend-requests/outgoing'),
        headers: <String, String>{
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      );
      _logResponse('GET /friend-requests/outgoing', response);
      decoded = _decodeMap(response.body);
      list = decoded != null ? (decoded['requests'] ?? decoded['data']) : null;
      if (list is List) {
        return list.map<Map<String, dynamic>>((dynamic e) => _asMap(e)).toList();
      }
      return <Map<String, dynamic>>[];
    } catch (e) {
      return <Map<String, dynamic>>[];
    }
  }

  static Future<Map<String, dynamic>> respondOffer({
    required String id,
    required bool accept,
  }) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final String token = prefs.getString('token') ?? '';
    if (token.isEmpty) return <String, dynamic>{'error': 'Missing authentication token'};
    try {
      final http.Response response = await http.post(
        Uri.parse('$baseUrl/friend-request/$id/respond'),
        headers: <String, String>{
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: jsonEncode(<String, String>{'action': accept ? 'accept' : 'decline'}),
      );
      _logResponse('POST /friend-request/:id/respond', response);
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return _decodeMap(response.body) ?? <String, dynamic>{'ok': true};
      }
      final Map<String, dynamic>? decoded = _decodeMap(response.body);
      final String message = decoded != null && decoded['error'] != null
          ? decoded['error'].toString()
          : 'Unexpected response from server (${response.statusCode})';
      return <String, dynamic>{'error': message};
    } catch (e) {
      return <String, dynamic>{'error': 'Network error: $e'};
    }
  }

  static Future<bool> cancelOffer(String id) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final String token = prefs.getString('token') ?? '';
    if (token.isEmpty) return false;
    try {
      final http.Response response = await http.delete(
        Uri.parse('$baseUrl/friend-request/$id'),
        headers: <String, String>{
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
        },
      );
      _logResponse('DELETE /friend-request/:id', response);
      return response.statusCode >= 200 && response.statusCode < 300;
    } catch (_) {
      return false;
    }
  }

  static Map<String, dynamic> _asMap(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return Map<String, dynamic>.from(value);
    return <String, dynamic>{'value': value.toString()};
  }

  /// Fetches a catalog of skills that can be selected when adding.
  ///
  /// Tries to pull skills where `UserId == -1` from the browse feed as the
  /// canonical list. If none are present, falls back to unique skill names
  /// across the entire browse list.
  static Future<List<String>> fetchSkillCatalog() async {
    final List<dynamic> browse = await fetchBrowseSkills();
    final List<String> fromCatalog = <String>[];
    final Set<String> allNames = <String>{};

    for (final dynamic raw in browse) {
      if (raw is! Map<String, dynamic>) continue;
      final Object? idValue = raw['UserId'] ?? raw['UserID'];
      final int? userId = idValue is int ? idValue : int.tryParse(idValue?.toString() ?? '');
      final String name = (raw['SkillName'] ?? raw['skill'] ?? raw['name'] ?? '').toString();
      if (name.isEmpty) continue;
      allNames.add(name);
      if (userId == -1) {
        fromCatalog.add(name);
      }
    }

    final List<String> result = fromCatalog.isNotEmpty
        ? fromCatalog
        : allNames.toList(growable: false);
    result.sort((a, b) => a.toLowerCase().compareTo(b.toLowerCase()));
    return result;
  }

  static Future<Map<String, dynamic>> updateProfile({
    String? firstName,
    String? lastName,
  }) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final String token = prefs.getString('token') ?? '';

    if (token.isEmpty) {
      return <String, dynamic>{'error': 'Missing authentication token'};
    }

    final Map<String, dynamic> body = <String, dynamic>{};
    if (firstName != null) body['firstName'] = firstName;
    if (lastName != null) body['lastName'] = lastName;

    try {
      // 1) Primary: align with web app endpoint
      http.Response response = await http.post(
        Uri.parse('$baseUrl/update-name'),
        headers: <String, String>{
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode(body),
      );
      _logResponse('POST /update-name', response);

      // 2) If 404, try conventional REST: PUT /user/:id
      if (response.statusCode == 404) {
        final String userId = prefs.getString('userId') ?? '';
        if (userId.isNotEmpty) {
          response = await http.put(
            Uri.parse('$baseUrl/user/$userId'),
            headers: <String, String>{
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode(<String, dynamic>{
              // Many backends expect camelCase for names
              if (firstName != null) 'firstName': firstName,
              if (lastName != null) 'lastName': lastName,
            }),
          );
          _logResponse('PUT /user/$userId', response);
        }
      }

      final String contentType = response.headers['content-type'] ?? '';

      if (response.statusCode >= 200 && response.statusCode < 300) {
        Map<String, dynamic>? decoded;
        if (contentType.contains('application/json')) {
          decoded = _decodeMap(response.body);
        }
        if (firstName != null) {
          await prefs.setString('firstName', firstName);
        }
        if (lastName != null) {
          await prefs.setString('lastName', lastName);
        }
        return decoded ?? <String, dynamic>{};
      }

      // If still 404 (or endpoint missing), save locally and surface a warning.
      if (response.statusCode == 404) {
        if (firstName != null) {
          await prefs.setString('firstName', firstName);
        }
        if (lastName != null) {
          await prefs.setString('lastName', lastName);
        }
        return <String, dynamic>{
          'warning': 'Profile endpoint not found. Saved locally only.',
        };
      }

      String message = 'Unexpected response from server (${response.statusCode})';
      if (contentType.contains('application/json')) {
        final Map<String, dynamic>? decoded = _decodeMap(response.body);
        if (decoded != null && decoded['error'] != null) {
          message = decoded['error'].toString();
        }
      }
      return <String, dynamic>{'error': message};
    } catch (e) {
      return <String, dynamic>{'error': 'Network error: $e'};
    }
  }

  static Future<Map<String, dynamic>?> fetchMyUser() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final String token = prefs.getString('token') ?? '';
    final String userId = prefs.getString('userId') ?? '';
    if (token.isEmpty || userId.isEmpty) return null;
    try {
      final http.Response response = await http.get(
        Uri.parse('$baseUrl/user/$userId'),
        headers: <String, String>{
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );
      _logResponse('GET /user/$userId', response);
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return _decodeMap(response.body);
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  static Future<Map<String, dynamic>> _post(
    String endpoint,
    Map<String, dynamic> body,
  ) async {
    try {
      final http.Response response = await http.post(
        Uri.parse('$baseUrl$endpoint'),
        headers: <String, String>{'Content-Type': 'application/json'},
        body: jsonEncode(body),
      );

      _logResponse('POST $endpoint', response);

      final Map<String, dynamic>? decoded = _decodeMap(response.body);

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return decoded ?? <String, dynamic>{};
      }

      final String message = decoded != null && decoded['error'] != null
          ? decoded['error'].toString()
          : 'Unexpected response from server (${response.statusCode})';
      return <String, dynamic>{'error': message};
    } catch (e) {
      return <String, dynamic>{'error': 'Network error: $e'};
    }
  }

  static Map<String, dynamic>? _decodeMap(String body) {
    if (body.isEmpty) {
      return null;
    }
    try {
      final dynamic decoded = jsonDecode(body);
      if (decoded is Map<String, dynamic>) {
        return decoded;
      }
    } catch (e) {
      print('JSON decode error: $e');
    }
    return null;
  }

  static void _logResponse(String label, http.Response response) {
    print('[$label] Status: ${response.statusCode}');
    if (response.body.isNotEmpty) {
      print('[$label] Body: ${response.body}');
    }
  }
}
