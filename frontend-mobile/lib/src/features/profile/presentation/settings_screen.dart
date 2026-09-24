import 'package:flutter/material.dart';
import '../../../core/theme/theme_controller.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: ThemeController.instance,
      builder: (context, _) {
        final ctrl = ThemeController.instance;
        final theme = Theme.of(context);

        return Scaffold(
          appBar: AppBar(
            title: const Text('Configuración'),
          ),
          body: ListView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            children: [
              // Sección Apariencia
              _SectionHeader(title: 'Apariencia y Tema'),
              Card(
                elevation: 0,
                color: theme.colorScheme.surface,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: BorderSide(color: Colors.black.withOpacity(0.06)),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Color principal de la app',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Elige el color con el que prefieres ver la interfaz:',
                        style: TextStyle(fontSize: 13, color: Colors.grey),
                      ),
                      const SizedBox(height: 14),
                      Wrap(
                        spacing: 12,
                        runSpacing: 12,
                        children: ThemeController.availableColors.map((color) {
                          final isSelected = ctrl.primaryColor.value == color.value;
                          return GestureDetector(
                            onTap: () => ctrl.setPrimaryColor(color),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                color: color,
                                shape: BoxShape.circle,
                                border: isSelected
                                    ? Border.all(color: Colors.white, width: 3)
                                    : null,
                                boxShadow: [
                                  if (isSelected)
                                    BoxShadow(
                                      color: color.withOpacity(0.6),
                                      blurRadius: 8,
                                      offset: const Offset(0, 2),
                                    ),
                                ],
                              ),
                              child: isSelected
                                  ? const Icon(Icons.check, color: Colors.white, size: 24)
                                  : null,
                            ),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 20),
                      const Divider(),
                      const SizedBox(height: 12),

                      // Fuente
                      const Text(
                        'Estilo de fuente',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                      ),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 8,
                        children: ThemeController.availableFonts.map((font) {
                          final isSelected = ctrl.fontFamily == font;
                          return ChoiceChip(
                            label: Text(font),
                            selected: isSelected,
                            selectedColor: ctrl.primaryColor.withOpacity(0.2),
                            onSelected: (_) => ctrl.setFontFamily(font),
                          );
                        }).toList(),
                      ),

                      const SizedBox(height: 20),
                      const Divider(),
                      const SizedBox(height: 12),

                      // Modo Oscuro / Claro
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text(
                          'Modo Oscuro',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                        subtitle: const Text(
                          'Activar apariencia oscura para cuidar tu vista',
                          style: TextStyle(fontSize: 13, color: Colors.grey),
                        ),
                        value: ctrl.themeMode == ThemeMode.dark,
                        onChanged: (val) {
                          ctrl.setThemeMode(val ? ThemeMode.dark : ThemeMode.light);
                        },
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 24),

              // Notificaciones y Preferencias
              _SectionHeader(title: 'Notificaciones'),
              Card(
                elevation: 0,
                color: theme.colorScheme.surface,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: BorderSide(color: Colors.black.withOpacity(0.06)),
                ),
                child: Column(
                  children: [
                    SwitchListTile(
                      title: const Text('Notificaciones de ofertas'),
                      subtitle: const Text('Recibir avisos cuando un trabajador envíe una propuesta'),
                      value: true,
                      onChanged: (v) {},
                    ),
                    const Divider(height: 1),
                    SwitchListTile(
                      title: const Text('Avisos de mensajes de chat'),
                      subtitle: const Text('Notificarme mensajes nuevos de coordinación'),
                      value: true,
                      onChanged: (v) {},
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),
              _SectionHeader(title: 'Acerca de'),
              Card(
                elevation: 0,
                color: theme.colorScheme.surface,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: BorderSide(color: Colors.black.withOpacity(0.06)),
                ),
                child: const ListTile(
                  title: Text('Versión de la aplicación'),
                  subtitle: Text('1.0.0 (PaTodo Móvil)'),
                  trailing: Icon(Icons.info_outline, color: Colors.grey),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.bold,
          color: Theme.of(context).colorScheme.primary,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}
