import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorage {
  SecureStorage._();

  static const _storage = FlutterSecureStorage();

  static const _accessKey = 'access_token';
  static const _refreshKey = 'refresh_token';
  static const _userKey = 'user';

  static Future<void> save(
    String accessToken,
    String refreshToken,
    String userJson,
  ) async {
    await _storage.write(key: _accessKey, value: accessToken);
    await _storage.write(key: _refreshKey, value: refreshToken);
    await _storage.write(key: _userKey, value: userJson);
  }

  static Future<String?> getAccessToken() => _storage.read(key: _accessKey);

  static Future<String?> getRefreshToken() => _storage.read(key: _refreshKey);

  static Future<String?> getUserJson() => _storage.read(key: _userKey);

  static Future<void> clear() async {
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
    await _storage.delete(key: _userKey);
  }
}
