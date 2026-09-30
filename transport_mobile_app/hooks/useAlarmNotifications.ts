import { useEffect, useState } from 'react';
import { Vibration, Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface UrgentAlarmPayload {
  id: string;
  title: string;
  message: string;
  urgency: 'low' | 'normal' | 'urgent' | 'alarm';
  type: string;
  created_at: string;
}

export function useAlarmNotifications() {
  const { employee } = useAuth();
  const [activeAlarm, setActiveAlarm] = useState<UrgentAlarmPayload | null>(null);

  useEffect(() => {
    if (!employee?.id) return;

    // Trigger audible/haptic vibration sequence
    const triggerAlarmAlert = (notif: UrgentAlarmPayload) => {
      setActiveAlarm(notif);

      if (Platform.OS !== 'web') {
        if (notif.urgency === 'alarm' || notif.type === 'alert') {
          // Continuous siren vibration pattern: 500ms on, 500ms off
          Vibration.vibrate([500, 500, 500, 500, 500, 1000], true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else {
          Vibration.vibrate(400);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
      }

      Alert.alert(
        `🚨 ${notif.urgency === 'alarm' ? 'URGENT DISPATCH ALARM' : 'System Notification'}`,
        `${notif.title}\n\n${notif.message}`,
        [
          {
            text: 'Acknowledge & Dismiss',
            onPress: () => {
              Vibration.cancel();
              setActiveAlarm(null);
            },
            style: 'default',
          },
        ],
        { cancelable: false }
      );
    };

    // Subscribe to Supabase Realtime for employee-specific or broadcast notifications
    const channel = supabase
      .channel(`driver-alarm-channel-${employee.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const newNotif = payload.new as any;
          if (
            newNotif.employee_id === employee.id ||
            newNotif.target_role === 'all' ||
            newNotif.target_role === 'driver'
          ) {
            if (newNotif.urgency === 'alarm' || newNotif.urgency === 'urgent' || newNotif.type === 'alert') {
              triggerAlarmAlert(newNotif);
            }
          }
        }
      )
      .subscribe();

    return () => {
      Vibration.cancel();
      supabase.removeChannel(channel);
    };
  }, [employee?.id]);

  return { activeAlarm, dismissAlarm: () => { Vibration.cancel(); setActiveAlarm(null); } };
}
