class LoginRequest {
  const LoginRequest({required this.email, required this.password});

  final String email;
  final String password;

  Map<String, dynamic> toJson() => {'email': email, 'password': password};
}

enum UserRole {
  client,
  worker,
  both;

  String get value => name;

  static UserRole fromValue(String value) => UserRole.values.firstWhere(
    (role) => role.name == value,
    orElse: () => UserRole.client,
  );
}

class RegisterRequest {
  const RegisterRequest({
    required this.firstName,
    required this.lastName,
    required this.email,
    required this.password,
    required this.phone,
    required this.role,
  });

  final String firstName;
  final String lastName;
  final String email;
  final String password;
  final String phone;
  final UserRole role;

  Map<String, dynamic> toJson() => {
    'firstName': firstName,
    'lastName': lastName,
    'email': email,
    'password': password,
    'phone': phone,
    'role': role.value,
  };
}

class UserDto {
  const UserDto({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.email,
    required this.role,
    this.avatarUrl,
  });

  final String id;
  final String firstName;
  final String lastName;
  final String email;
  final String role;
  final String? avatarUrl;

  factory UserDto.fromJson(Map<String, dynamic> json) => UserDto(
    id: json['id'] as String,
    firstName: json['firstName'] as String,
    lastName: json['lastName'] as String,
    email: json['email'] as String,
    role: json['role'] as String,
    avatarUrl: json['avatarUrl'] as String?,
  );
}

class AuthResponse {
  const AuthResponse({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresIn,
    required this.user,
  });

  final String accessToken;
  final String refreshToken;
  final int expiresIn;
  final UserDto user;

  factory AuthResponse.fromJson(Map<String, dynamic> json) => AuthResponse(
    accessToken: json['accessToken'] as String,
    refreshToken: json['refreshToken'] as String,
    expiresIn: (json['expiresIn'] as num?)?.toInt() ?? 0,
    user: UserDto.fromJson(json['user'] as Map<String, dynamic>),
  );
}
