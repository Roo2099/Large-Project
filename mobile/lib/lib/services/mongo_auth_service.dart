import 'dart:async';
import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:mongo_dart/mongo_dart.dart';

class MongoAuthService {
  MongoAuthService._();

  static final MongoAuthService instance = MongoAuthService._();
  static const String collectionName = 'users';

  static const String _connectionString =
      'mongodb+srv://skillswapadmin:Poos24@skillswap.fqd5j5s.mongodb.net/skillswap?retryWrites=true&w=majority&appName=SkillSwap';

  Future<Map<String, dynamic>> login(String identifier, String password) async {
    final String trimmedIdentifier = identifier.trim();
    final String trimmedPassword = password.trim();

    if (trimmedIdentifier.isEmpty || trimmedPassword.isEmpty) {
      return {'error': 'Email/username and password are required'};
    }

    Db? db;
    try {
      db = await Db.create(_connectionString);
      await db.open();

      final DbCollection usersCollection = db.collection(collectionName);
      final String lowerIdentifier = trimmedIdentifier.toLowerCase();

      final Map<String, dynamic>? user = await usersCollection.findOne({
        r'$or': [
          {'email': lowerIdentifier},
          {'email': trimmedIdentifier},
          {'login': lowerIdentifier},
          {'login': trimmedIdentifier},
          {'username': lowerIdentifier},
          {'username': trimmedIdentifier},
        ],
      });

      if (user == null) {
        return {'error': 'Account not found'};
      }

      final Object? storedHash =
          user['passwordHash'] ??
          user['password_hash'] ??
          user['hashedPassword'];
      final Object? storedPassword = user['password'] ?? user['pass'];

      final bool isMatch;
      if (storedHash is String) {
        final String incomingHash = sha256
            .convert(utf8.encode(trimmedPassword))
            .toString();
        isMatch = _constantTimeComparison(storedHash, incomingHash);
      } else if (storedPassword is String) {
        isMatch = _constantTimeComparison(storedPassword, trimmedPassword);
      } else {
        return {'error': 'Stored credentials missing password information'};
      }

      if (!isMatch) {
        return {'error': 'Invalid credentials'};
      }

      final Object? rawId = user['_id'];
      final String userId;
      if (rawId is ObjectId) {
        userId = rawId.oid;
      } else {
        userId = rawId?.toString() ?? trimmedIdentifier;
      }

      final Map<String, dynamic> sanitizedUser = <String, dynamic>{
        'id': userId,
        'email': (user['email'] ?? user['login'] ?? trimmedIdentifier)
            .toString(),
        'name': (user['name'] ?? user['username'] ?? '').toString(),
      };

      return <String, dynamic>{'token': userId, 'user': sanitizedUser};
    } catch (error) {
      return {'error': 'Login failed: $error'};
    } finally {
      await db?.close();
    }
  }

  static bool _constantTimeComparison(String a, String b) {
    if (a.length != b.length) {
      return false;
    }
    int diff = 0;
    for (int i = 0; i < a.length; i++) {
      diff |= a.codeUnitAt(i) ^ b.codeUnitAt(i);
    }
    return diff == 0;
  }
}
