import { Tabs } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme';

const TAB_ICONS: Record<string, string> = {
  index: '📊',
  cards: '🃏',
  settings: '⚙️',
};

function TabIcon({ name, color, focused }: { name: string; color: string; focused: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={[
      styles.iconContainer,
      focused && { backgroundColor: color + '22', borderRadius: theme.radius.sm },
    ]}>
      <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{TAB_ICONS[name]}</Text>
    </View>
  );
}

export default function TabLayout() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.tabBar,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
          elevation: 0,
        },
        tabBarActiveTintColor: theme.colors.tabBarActive,
        tabBarInactiveTintColor: theme.colors.tabBarInactive,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginBottom: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarAccessibilityLabel: 'Dashboard Tab',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="index" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="cards"
        options={{
          title: 'Karten',
          tabBarAccessibilityLabel: 'Trading Cards Tab',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="cards" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Einstellungen',
          tabBarAccessibilityLabel: 'Settings Tab',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="settings" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
