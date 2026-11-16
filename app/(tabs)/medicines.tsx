import { router } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MedicineCard } from '@/src/components/cards/MedicineCard';
import { AppButton } from '@/src/components/common/AppButton';
import { StateView } from '@/src/components/feedback/StateView';
import { colors, spacing } from '@/src/constants/theme';
import { useMedicineStore } from '@/src/store/useMedicineStore';

export default function MedicinesScreen() {
  const medicines = useMedicineStore((state) => state.items);
  const loading = useMedicineStore((state) => state.loading);
  const error = useMedicineStore((state) => state.error);
  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <FlatList
        data={medicines}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MedicineCard medicine={item} />}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <Text style={styles.intro}>Keep your treatment plan clear and current.</Text>
            <AppButton
              label="+ Add medicine"
              onPress={() => router.push('/medicine/add')}
              style={styles.add}
            />
            {loading ? <StateView kind="loading" message="Loading medicines…" /> : null}
            {error ? <StateView kind="error" message={error} /> : null}
          </View>
        }
        ListEmptyComponent={
          !loading && !error ? (
            <StateView
              kind="empty"
              title="No medicines yet"
              message="Add your first medicine to begin."
            />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  intro: { color: colors.muted, marginBottom: spacing.md, fontSize: 15 },
  add: { marginBottom: spacing.lg },
});
