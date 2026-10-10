import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../services/data/firebase_service.dart';

/// Acción mostrada solo al cliente de un trabajo finalizado.
class ReviewWorkerButton extends StatefulWidget {
  final String jobId;
  final String workerName;

  const ReviewWorkerButton({
    super.key,
    required this.jobId,
    required this.workerName,
  });

  @override
  State<ReviewWorkerButton> createState() => _ReviewWorkerButtonState();
}

class _ReviewWorkerButtonState extends State<ReviewWorkerButton> {
  bool _loading = true;
  bool _alreadyReviewed = false;

  @override
  void initState() {
    super.initState();
    _loadStatus();
  }

  Future<void> _loadStatus() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return;
    try {
      final reviews = await FirebaseFirestore.instance
          .collection('reviews')
          .where('jobId', isEqualTo: widget.jobId)
          .get();
      _alreadyReviewed = reviews.docs.any(
        (document) => document.data()['reviewerId'] == uid,
      );
    } catch (_) {
      // El API conserva la protección contra reseñas duplicadas.
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openReview() async {
    final submitted = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ReviewSheet(
        jobId: widget.jobId,
        workerName: widget.workerName,
      ),
    );
    if (submitted == true && mounted) {
      setState(() => _alreadyReviewed = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const SizedBox(
        height: 52,
        child: Center(
          child: CircularProgressIndicator(color: AppTheme.primaryGreen),
        ),
      );
    }
    if (_alreadyReviewed) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 15),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: const Color(0xFFEAF7EC),
          borderRadius: BorderRadius.circular(17),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.check_circle_outline_rounded, color: AppTheme.primaryGreen),
            SizedBox(width: 8),
            Text(
              'Ya calificaste este trabajo',
              style: TextStyle(
                color: AppTheme.primaryGreen,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      );
    }

    return SizedBox(
      width: double.infinity,
      height: 52,
      child: FilledButton.icon(
        onPressed: _openReview,
        icon: const Icon(Icons.star_outline_rounded),
        label: Text('Calificar a ${widget.workerName}'),
        style: FilledButton.styleFrom(
          backgroundColor: const Color(0xFFFFA000),
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(17)),
        ),
      ),
    );
  }
}

class _ReviewSheet extends StatefulWidget {
  final String jobId;
  final String workerName;

  const _ReviewSheet({required this.jobId, required this.workerName});

  @override
  State<_ReviewSheet> createState() => _ReviewSheetState();
}

class _ReviewSheetState extends State<_ReviewSheet> {
  final TextEditingController _comment = TextEditingController();
  int _rating = 0;
  bool _sending = false;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_rating == 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Selecciona una calificación de 1 a 5 estrellas.')),
      );
      return;
    }
    setState(() => _sending = true);
    try {
      await FirebaseService().createReview(
        jobId: widget.jobId,
        rating: _rating,
        comment: _comment.text,
      );
      if (!mounted) return;
      Navigator.of(context).pop(true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Gracias por compartir tu experiencia.')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No pudimos enviar tu calificación. Inténtalo de nuevo.'),
        ),
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return PopScope(
      canPop: !_sending,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.fromLTRB(16, 0, 16, bottomInset + 16),
          child: Material(
            borderRadius: BorderRadius.circular(28),
            color: Colors.white,
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Califica a ${widget.workerName}',
                    style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Tu opinión ayuda a construir una comunidad de confianza.',
                    style: TextStyle(color: AppTheme.textLight),
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'Calificación general',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(
                      5,
                      (index) => IconButton(
                        tooltip: '${index + 1} estrellas',
                        onPressed: _sending
                            ? null
                            : () => setState(() => _rating = index + 1),
                        icon: Icon(
                          index < _rating
                              ? Icons.star_rounded
                              : Icons.star_outline_rounded,
                          color: const Color(0xFFFFA000),
                          size: 38,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _comment,
                    enabled: !_sending,
                    minLines: 3,
                    maxLines: 5,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: InputDecoration(
                      labelText: 'Comentario (opcional)',
                      hintText: 'Cuéntanos cómo fue tu experiencia.',
                      alignLabelWithHint: true,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: FilledButton(
                      onPressed: _sending ? null : _submit,
                      style: FilledButton.styleFrom(
                        backgroundColor: AppTheme.primaryGreen,
                        foregroundColor: Colors.white,
                      ),
                      child: _sending
                          ? const SizedBox(
                              height: 22,
                              width: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Enviar calificación'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
