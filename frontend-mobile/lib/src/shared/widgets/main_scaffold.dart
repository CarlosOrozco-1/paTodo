import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

class MainScaffold extends StatefulWidget {
  final List<Widget> screens;
  final VoidCallback? onCreatePressed;

  const MainScaffold({
    super.key,
    required this.screens,
    this.onCreatePressed,
  });

  static MainScaffoldState? of(BuildContext context) {
    return context.findAncestorStateOfType<MainScaffoldState>();
  }

  static void switchTab(BuildContext context, int index) {
    of(context)?.setIndex(index);
  }

  @override
  State<MainScaffold> createState() => MainScaffoldState();
}

class MainScaffoldState extends State<MainScaffold> {
  int _currentIndex = 0;

  void setIndex(int index) {
    if (mounted && index >= 0 && index < widget.screens.length) {
      setState(() => _currentIndex = index);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isKeyboardOpen = MediaQuery.of(context).viewInsets.bottom > 0;

    return PopScope(
      canPop: _currentIndex == 0,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && _currentIndex != 0) {
          setState(() => _currentIndex = 0);
        }
      },
      child: Scaffold(
        resizeToAvoidBottomInset: false,
        body: IndexedStack(
          index: _currentIndex,
          children: widget.screens,
        ),
      floatingActionButton: isKeyboardOpen
          ? null
          : FloatingActionButton(
              onPressed: widget.onCreatePressed,
              backgroundColor: AppTheme.primaryGreen,
              shape: const CircleBorder(),
              child: const Icon(Icons.add, color: Colors.white, size: 30),
            ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      bottomNavigationBar: isKeyboardOpen
          ? null
          : BottomAppBar(
              shape: const CircularNotchedRectangle(),
              notchMargin: 8.0,
              color: Colors.white,
              child: SizedBox(
                height: 60,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    IconButton(
                      icon: Icon(
                        Icons.home_outlined,
                        color: _currentIndex == 0 ? AppTheme.primaryGreen : AppTheme.textLight,
                      ),
                      onPressed: () => setState(() => _currentIndex = 0),
                    ),
                    IconButton(
                      icon: Icon(
                        Icons.search,
                        color: _currentIndex == 1 ? AppTheme.primaryGreen : AppTheme.textLight,
                      ),
                      onPressed: () => setState(() => _currentIndex = 1),
                    ),
                    const SizedBox(width: 40), // Space for FAB
                    IconButton(
                      icon: Icon(
                        Icons.assignment_outlined,
                        color: _currentIndex == 2 ? AppTheme.primaryGreen : AppTheme.textLight,
                      ),
                      onPressed: () => setState(() => _currentIndex = 2),
                    ),
                    IconButton(
                      icon: Icon(
                        Icons.person_outline,
                        color: _currentIndex == 3 ? AppTheme.primaryGreen : AppTheme.textLight,
                      ),
                      onPressed: () => setState(() => _currentIndex = 3),
                    ),
                  ],
                ),
            ),
          ),
      ),
    );
  }
}