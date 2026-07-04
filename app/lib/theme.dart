import 'package:flutter/material.dart';

const Color kNavy = Color(0xFF001F3F);
const Color kTeal = Color(0xFF2EC4B6);

ThemeData buildAppTheme() {
  return ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: kNavy,
      primary: kNavy,
      secondary: kTeal,
      brightness: Brightness.light,
    ),
    scaffoldBackgroundColor: const Color(0xFFF4F7F9),
    appBarTheme: const AppBarTheme(
      backgroundColor: kNavy,
      foregroundColor: Colors.white,
      centerTitle: true,
    ),
    textTheme: const TextTheme(
      titleLarge: TextStyle(fontWeight: FontWeight.bold, color: kNavy),
      titleMedium: TextStyle(fontWeight: FontWeight.w600, color: kNavy),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: kNavy,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    ),
  );
}
