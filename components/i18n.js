import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, transitions } from './theme';

const STORAGE_KEY = 'helpme.lang';

export const LANGUAGES = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'ru', label: 'RU', name: 'Русский' },
  { code: 'ka', label: 'GE', name: 'ქართული' },
];

// Translation dictionaries. Keys are English source strings; missing
// keys fall back to the key itself, so unlocalized text stays readable.
const dict = {
  ru: {
    // common
    'Sign out': 'Выйти',
    'Loading requests…': 'Загрузка запросов…',
    'Hang tight': 'Минуточку',
    'Close': 'Закрыть',
    'Cancel': 'Отмена',
    'Delete': 'Удалить',
    'Remove': 'Удалить',
    'Missing': 'Не заполнено',

    // Auth
    'Create your account in seconds': 'Создайте аккаунт за секунды',
    'Welcome back — sign in to continue': 'С возвращением — войдите, чтобы продолжить',
    'Sign In': 'Вход',
    'Register': 'Регистрация',
    'Name': 'Имя',
    'Your name': 'Ваше имя',
    'Phone': 'Телефон',
    'Password': 'Пароль',
    'Min. 4 characters': 'Мин. 4 символа',
    'Enter your phone number': 'Введите номер телефона',
    'Enter your password': 'Введите пароль',
    'Enter your name': 'Введите имя',
    'Something went wrong': 'Что-то пошло не так',
    'Network error. Try again.': 'Ошибка сети. Попробуйте снова.',
    'Create account': 'Создать аккаунт',
    'Sign in': 'Войти',
    'Already have an account? ': 'Уже есть аккаунт? ',
    'New here? ': 'Впервые здесь? ',
    'Create one': 'Создать',
    'Add profile photo (optional)': 'Добавить фото профиля (необязательно)',
    'Tap to change photo': 'Нажмите, чтобы изменить фото',
    'Upload failed': 'Ошибка загрузки',
    'Could not upload image': 'Не удалось загрузить изображение',

    // Browse
    'Browse': 'Поиск',
    'request': 'запрос',
    'requests': 'запросов',
    'nearby': 'поблизости',
    'within': 'в радиусе',
    'Search requests…': 'Поиск запросов…',
    'Radius': 'Радиус',
    'Any': 'Любой',
    'Getting your location…': 'Получаем вашу геолокацию…',
    'Geolocation not available': 'Геолокация недоступна',
    'Could not get location': 'Не удалось получить локацию',
    'No matches': 'Ничего не найдено',
    'Try a different search': 'Попробуйте другой запрос',
    'Generating image…': 'Генерация изображения…',
    'Number': 'Номер',
    'Call now': 'Позвонить',
    'Open in Google Maps ↗': 'Открыть в Google Maps ↗',
    'Unfold location': 'Раскрыть локацию',

    // My requests
    'New request': 'Новый запрос',
    'Mine': 'Мои',
    'Description': 'Описание',
    'What do you need help with?': 'С чем нужна помощь?',
    'Price (USD)': 'Цена (USD)',
    'Location': 'Локация',
    'Use my location': 'Моя локация',
    'Type address': 'Ввести адрес',
    'Location pinned': 'Локация закреплена',
    'Drag the pin on the map to adjust': 'Перетащите метку на карте, чтобы скорректировать',
    'Re-detect': 'Обновить',
    'Detecting your location…': 'Определяем вашу локацию…',
    'Geolocation is not available on this device': 'Геолокация недоступна на этом устройстве',
    'Tap detect to pin your current location on the map': 'Нажмите «Определить», чтобы отметить вашу текущую локацию на карте',
    'Detect my location': 'Определить мою локацию',
    'City, State or full address': 'Город, штат или полный адрес',
    'Post request': 'Опубликовать',
    'No requests yet': 'Пока нет запросов',
    'Tap "New request" to post your first one': 'Нажмите «Новый запрос», чтобы создать первый',
    'Add a description.': 'Добавьте описание.',
    'Add a price.': 'Добавьте цену.',
    'Add a location.': 'Добавьте локацию.',
    'Delete request?': 'Удалить запрос?',
    'This will permanently remove this request.': 'Запрос будет удалён без возможности восстановления.',
    'Language': 'Язык',
    'Photos (optional)': 'Фото (необязательно)',
    'Add photos': 'Добавить фото',
    'Remove photo': 'Удалить фото',
  },
  ka: {
    // common
    'Sign out': 'გასვლა',
    'Loading requests…': 'მოთხოვნები იტვირთება…',
    'Hang tight': 'მოიცადეთ',
    'Close': 'დახურვა',
    'Cancel': 'გაუქმება',
    'Delete': 'წაშლა',
    'Remove': 'წაშლა',
    'Missing': 'შეუვსებელია',

    // Auth
    'Create your account in seconds': 'შექმენით ანგარიში წამებში',
    'Welcome back — sign in to continue': 'კეთილი იყოს თქვენი დაბრუნება — გაიარეთ ავტორიზაცია',
    'Sign In': 'შესვლა',
    'Register': 'რეგისტრაცია',
    'Name': 'სახელი',
    'Your name': 'თქვენი სახელი',
    'Phone': 'ტელეფონი',
    'Password': 'პაროლი',
    'Min. 4 characters': 'მინ. 4 სიმბოლო',
    'Enter your phone number': 'შეიყვანეთ ტელეფონის ნომერი',
    'Enter your password': 'შეიყვანეთ პაროლი',
    'Enter your name': 'შეიყვანეთ სახელი',
    'Something went wrong': 'რაღაც შეცდომა მოხდა',
    'Network error. Try again.': 'ქსელის შეცდომა. სცადეთ ხელახლა.',
    'Create account': 'ანგარიშის შექმნა',
    'Sign in': 'შესვლა',
    'Already have an account? ': 'უკვე გაქვთ ანგარიში? ',
    'New here? ': 'ახალი ხართ აქ? ',
    'Create one': 'შექმენით',
    'Add profile photo (optional)': 'პროფილის ფოტოს დამატება (არასავალდებულო)',
    'Tap to change photo': 'დააჭირეთ ფოტოს შესაცვლელად',
    'Upload failed': 'ატვირთვა ვერ მოხერხდა',
    'Could not upload image': 'სურათის ატვირთვა ვერ მოხერხდა',

    // Browse
    'Browse': 'ძიება',
    'request': 'მოთხოვნა',
    'requests': 'მოთხოვნა',
    'nearby': 'ახლომახლო',
    'within': 'რადიუსში',
    'Search requests…': 'მოთხოვნების ძიება…',
    'Radius': 'რადიუსი',
    'Any': 'ნებისმიერი',
    'Getting your location…': 'თქვენი მდებარეობის მიღება…',
    'Geolocation not available': 'გეოლოკაცია მიუწვდომელია',
    'Could not get location': 'მდებარეობის მიღება ვერ მოხერხდა',
    'No matches': 'შედეგი არ მოიძებნა',
    'Try a different search': 'სცადეთ სხვა ძიება',
    'Generating image…': 'სურათის გენერაცია…',
    'Number': 'ნომერი',
    'Call now': 'დარეკვა',
    'Open in Google Maps ↗': 'გახსნა Google Maps-ში ↗',
    'Unfold location': 'მდებარეობის გახსნა',

    // My requests
    'New request': 'ახალი მოთხოვნა',
    'Mine': 'ჩემი',
    'Description': 'აღწერა',
    'What do you need help with?': 'რაში გჭირდებათ დახმარება?',
    'Price (USD)': 'ფასი (USD)',
    'Location': 'მდებარეობა',
    'Use my location': 'ჩემი მდებარეობა',
    'Type address': 'მისამართის შეყვანა',
    'Location pinned': 'მდებარეობა მონიშნულია',
    'Drag the pin on the map to adjust': 'გადაიტანეთ ნიშანი რუკაზე კორექტირებისთვის',
    'Re-detect': 'თავიდან',
    'Detecting your location…': 'თქვენი მდებარეობის განსაზღვრა…',
    'Geolocation is not available on this device': 'გეოლოკაცია მიუწვდომელია ამ მოწყობილობაზე',
    'Tap detect to pin your current location on the map': 'დააჭირეთ ღილაკს თქვენი მდებარეობის რუკაზე მოსანიშნად',
    'Detect my location': 'ჩემი მდებარეობის განსაზღვრა',
    'City, State or full address': 'ქალაქი, შტატი ან სრული მისამართი',
    'Post request': 'გამოქვეყნება',
    'No requests yet': 'ჯერ მოთხოვნები არ არის',
    'Tap "New request" to post your first one': 'დააჭირეთ «ახალი მოთხოვნა»-ს პირველის შესაქმნელად',
    'Add a description.': 'დაამატეთ აღწერა.',
    'Add a price.': 'დაამატეთ ფასი.',
    'Add a location.': 'დაამატეთ მდებარეობა.',
    'Delete request?': 'მოთხოვნის წაშლა?',
    'This will permanently remove this request.': 'მოთხოვნა სამუდამოდ წაიშლება.',
    'Language': 'ენა',
    'Photos (optional)': 'ფოტოები (არასავალდებულო)',
    'Add photos': 'ფოტოს დამატება',
    'Remove photo': 'ფოტოს წაშლა',
  },
};

const I18nContext = createContext({
  lang: 'en',
  setLang: () => {},
  t: (s) => s,
});

function detectInitialLang() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 'en';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && dict[stored] !== undefined) return stored;
    if (stored === 'en') return 'en';
  } catch {}
  const nav = typeof navigator !== 'undefined' ? (navigator.language || '').toLowerCase() : '';
  if (nav.startsWith('ru')) return 'ru';
  if (nav.startsWith('ka')) return 'ka';
  return 'en';
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => detectInitialLang());

  const setLang = useCallback((next) => {
    setLangState(next);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try { window.localStorage.setItem(STORAGE_KEY, next); } catch {}
    }
  }, []);

  const t = useCallback(
    (key) => {
      if (lang === 'en') return key;
      const table = dict[lang];
      if (!table) return key;
      return table[key] ?? key;
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  return useContext(I18nContext);
}

export function LanguageSwitcher({ size = 'sm', style }) {
  const { lang, setLang } = useTranslation();
  return (
    <View style={[switcherStyles.row, size === 'md' && switcherStyles.rowMd, style]}>
      {LANGUAGES.map((l) => {
        const active = l.code === lang;
        return (
          <Pressable
            key={l.code}
            onPress={() => setLang(l.code)}
            style={({ hovered }) => [
              switcherStyles.chip,
              size === 'md' && switcherStyles.chipMd,
              active && switcherStyles.chipActive,
              hovered && !active && switcherStyles.chipHover,
              Platform.OS === 'web' && { transition: transitions.fast, cursor: 'pointer' },
            ]}
          >
            <Text
              style={[
                switcherStyles.text,
                size === 'md' && switcherStyles.textMd,
                active && switcherStyles.textActive,
              ]}
            >
              {l.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const switcherStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    padding: 2,
  },
  rowMd: { gap: 6, padding: 3 },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  chipMd: { paddingHorizontal: 12, paddingVertical: 5 },
  chipActive: { backgroundColor: colors.accent },
  chipHover: { backgroundColor: colors.surfaceAlt },
  text: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.textSecondary,
  },
  textMd: { fontSize: 12 },
  textActive: { color: '#fff' },
});
