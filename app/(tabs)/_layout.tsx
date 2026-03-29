import { Tabs } from 'expo-router';
import { Image, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme';

const TAB_ICONS = {
  index:    require('@/assets/icons/tab_dashboard.png'),
  cards:    require('@/assets/icons/tab_cards.png'),
  settings: require('@/assets/icons/tab_settings.png'),
} as const;

function TabIcon({ name, color, focused }: { name: keyof typeof TAB_ICONS; color: string; focused: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={[
      styles.iconContainer,
      focused && { backgroundColor: color + '20', borderRadius: theme.radius.md },
    ]}>
      <Image
        source={TAB_ICONS[name]}
        style={[
          styles.icon,
          {
            tintColor: focused ? color : theme.colors.tabBarInactive,
            opacity: focused ? 1 : 0.55,
          },
        ]}
        resizeMode="contain"
      />
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
          height: 68 + insets.bottom,
          paddingBottom: insets.bottom + 4,
          paddingTop: 6,
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
    width: 48,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 26,
    height: 26,
  },
});
