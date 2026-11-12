import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { limitLoginInput, validateLoginInput, type LoginField, type LoginResponse } from '@packages/shared';
import api from '@/services/client';
import { completeLogin } from '@/services/auth';
import { useCoopPartyStore } from '@/store/coopParty';
import { useMissionCompleteStore } from '@/store/missionComplete';
import { useOnboardingStore } from '@/store/onboarding';
import { useTreasureProgressStore } from '@/store/treasureProgress';
/** 앱 시작 로그인 화면. 성공 후 루트 네비게이터가 인증 화면으로 전환한다. */
export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const identifierInput = useRef<TextInput>(null);
  const passwordInput = useRef<TextInput>(null);
  function changeInput(field: LoginField, input: string) {
    const result = limitLoginInput(field, input);
    // 값이 이미 최대 길이여도 네이티브 입력창에 붙여넣은 초과 문자를 즉시 제거한다.
    if (result.error) (field === 'identifier' ? identifierInput : passwordInput).current?.setNativeProps({ text: result.value });
    (field === 'identifier' ? setIdentifier : setPassword)(result.value);
    setError(result.error);
  }
  async function submit() {
    if (submitting.current || !identifier.trim() || !password) return;
    const validationError = validateLoginInput(identifier, password);
    if (validationError) {
      setError(validationError);
      return;
    }
    submitting.current = true;
    setPending(true);
    setError('');
    try {
      const { data } = await api.post<LoginResponse>('/api/v2/auth/login', { email: identifier.trim(), password, deviceInfo: Platform.OS });
      queryClient.clear();
      useCoopPartyStore.getState().reset();
      useMissionCompleteStore.getState().clear();
      useOnboardingStore.getState().reset();
      useTreasureProgressStore.getState().reset();
      await completeLogin(data);
    } catch (cause) {
      const failure = cause as { response?: { data?: { message?: string } } };
      setError(failure.response?.data?.message ?? '로그인하지 못했습니다. 연결 상태를 확인해 주세요.');
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }
  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content, { paddingTop: insets.top + 40 }]}>
        <View style={s.form}>
          <Text style={s.tagline}>나만의 제주 여행 기록</Text>
          <Text style={s.title}>잠깐제주</Text>
          <Text style={s.subtitle}>로그인하고 여행을 이어가세요.</Text>
          <Text style={s.label}>아이디 또는 이메일</Text>
          <TextInput
            ref={identifierInput}
            style={s.input}
            value={identifier}
            onChangeText={(value) => changeInput('identifier', value)}
            placeholder="아이디 또는 이메일을 입력해 주세요"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
          />
          <Text style={s.label}>비밀번호</Text>
          <TextInput
            ref={passwordInput}
            style={s.input}
            value={password}
            onChangeText={(value) => changeInput('password', value)}
            placeholder="비밀번호를 입력해 주세요"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            onSubmitEditing={() => void submit()}
          />
          {!!error && (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          )}
          <Pressable
            accessibilityRole="button"
            disabled={pending || !identifier.trim() || !password}
            onPress={() => void submit()}
            style={[s.button, (pending || !identifier.trim() || !password) && s.disabled]}
          >
            <Text style={s.buttonText}>{pending ? '로그인 중…' : '로그인'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fffdf7' },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 40 },
  form: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  tagline: { fontFamily: 'Pretendard-SemiBold', color: '#789e38', fontSize: 14, marginBottom: 12 },
  title: { fontFamily: 'Pretendard-Bold', fontSize: 38, color: '#242424' },
  subtitle: { fontFamily: 'Pretendard-Regular', color: '#777', fontSize: 14, marginTop: 16, marginBottom: 36 },
  label: { fontFamily: 'Pretendard-SemiBold', fontSize: 14, color: '#242424', marginBottom: 10 },
  input: {
    fontFamily: 'Pretendard-Regular',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    marginBottom: 22,
    color: '#242424',
  },
  button: { backgroundColor: '#242424', borderRadius: 999, paddingVertical: 18, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontFamily: 'Pretendard-Bold', fontSize: 16 },
  disabled: { opacity: 0.4 },
  error: { fontFamily: 'Pretendard-Regular', color: '#c13d32', fontSize: 13, marginBottom: 12 },
});
