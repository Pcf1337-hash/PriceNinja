import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/src/theme';
import { ThemedView, ThemedText, GlowCard } from '@/src/components/ui';

export default function ScanChooserModal() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [showTextInput, setShowTextInput] = useState(false);
  const [textQuery, setTextQuery] = useState('');

  function handleCameraPress() {
    router.push('/scan');
  }

  function handleTextSearch() {
    const trimmed = textQuery.trim();
    if (trimmed.length === 0) return;
    router.push({ pathname: '/scan', params: { textQuery: trimmed } });
  }

  function handleClose() {
    router.back();
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Dimmed overlay — tap to close */}
      <Pressable style={styles.overlay} onPress={handleClose} accessibilityLabel="Schließen" />

      {/* Card sheet */}
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            borderColor: theme.colors.border,
            paddingBottom: insets.bottom + 24,
          },
        ]}
      >
        {/* Drag handle */}
        <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />

        {/* Header row */}
        <View style={styles.headerRow}>
          <ThemedText weight="bold" size="xl">
            Artikel scannen
          </ThemedText>
          <TouchableOpacity
            onPress={handleClose}
            style={[styles.closeButton, { backgroundColor: theme.colors.surfaceAlt, borderRadius: 20 }]}
            accessibilityLabel="Modal schließen"
          >
            <ThemedText size="md" variant="secondary">✕</ThemedText>
          </TouchableOpacity>
        </View>

        <ThemedText variant="muted" size="sm" style={styles.subtitle}>
          Wähle eine Eingabemethode
        </ThemedText>

        {/* Camera option */}
        <TouchableOpacity
          onPress={handleCameraPress}
          activeOpacity={0.8}
          accessibilityLabel="Kamera öffnen"
        >
          <GlowCard style={[styles.optionCard, { borderColor: theme.colors.primary + '55' }]}>
            <ThemedText style={styles.optionEmoji}>📷</ThemedText>
            <View style={styles.optionText}>
              <ThemedText weight="bold" size="lg">
                Kamera
              </ThemedText>
              <ThemedText variant="muted" size="sm" style={{ marginTop: 2 }}>
                Artikel fotografieren — KI erkennt automatisch
              </ThemedText>
            </View>
            <ThemedText variant="muted" size="lg">›</ThemedText>
          </GlowCard>
        </TouchableOpacity>

        {/* Text search option */}
        <TouchableOpacity
          onPress={() => setShowTextInput(true)}
          activeOpacity={0.8}
          accessibilityLabel="Textsuche öffnen"
        >
          <GlowCard
            style={[
              styles.optionCard,
              {
                borderColor: showTextInput
                  ? theme.colors.accent + '88'
                  : theme.colors.border,
              },
            ]}
          >
            <ThemedText style={styles.optionEmoji}>✏️</ThemedText>
            <View style={styles.optionText}>
              <ThemedText weight="bold" size="lg">
                Textsuche
              </ThemedText>
              <ThemedText variant="muted" size="sm" style={{ marginTop: 2 }}>
                Artikelname eintippen und direkt suchen
              </ThemedText>
            </View>
            <ThemedText variant="muted" size="lg">›</ThemedText>
          </GlowCard>
        </TouchableOpacity>

        {/* Inline text input — revealed when Textsuche is tapped */}
        {showTextInput && (
          <View style={styles.textInputContainer}>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.colors.surfaceAlt,
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.md,
                },
              ]}
              placeholder="z.B. iPhone 14 Pro, RTX 4090..."
              placeholderTextColor={theme.colors.textMuted}
              value={textQuery}
              onChangeText={setTextQuery}
              autoFocus
              returnKeyType="search"
              onSubmitEditing={handleTextSearch}
              accessibilityLabel="Artikelname eingeben"
            />
            <TouchableOpacity
              onPress={handleTextSearch}
              style={[
                styles.searchButton,
                {
                  backgroundColor: theme.colors.primary,
                  borderRadius: theme.radius.md,
                  opacity: textQuery.trim().length === 0 ? 0.4 : 1,
                },
              ]}
              disabled={textQuery.trim().length === 0}
              accessibilityLabel="Suchen"
            >
              <ThemedText
                weight="bold"
                size="md"
                style={{ color: theme.colors.background }}
              >
                Suchen
              </ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    marginBottom: 20,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  optionEmoji: {
    fontSize: 32,
  },
  optionText: {
    flex: 1,
  },
  textInputContainer: {
    gap: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  searchButton: {
    paddingVertical: 13,
    alignItems: 'center',
  },
});
