import 'package:flutter/material.dart';

/// Llave global del Navigator. Permite que los push (FCM) abran la pantalla
/// de llamada entrante desde cualquier punto, incluido el arranque en frío.
final GlobalKey<NavigatorState> appNavigatorKey = GlobalKey<NavigatorState>();
