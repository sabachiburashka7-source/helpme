import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from './theme';
import * as Storage from './storage';

const STORAGE_KEY = 'helpme.lang';
const DEFAULT_LANG = 'ka';

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
    'Verification code': 'Код подтверждения',
    'Enter your phone number': 'Введите номер телефона',
    'Include country code, e.g. +1 555 123 4567': 'Укажите код страны, например +7 999 123 45 67',
    'Enter your name': 'Введите имя',
    'Enter the code you received': 'Введите полученный код',
    'Something went wrong': 'Что-то пошло не так',
    'Network error. Try again.': 'Ошибка сети. Попробуйте снова.',
    'Create account': 'Создать аккаунт',
    'Sign in': 'Войти',
    'Send code': 'Отправить код',
    'We’ll text you a one-time code to sign in. No password needed.': 'Мы отправим вам одноразовый код для входа. Пароль не нужен.',
    'We sent a code to {phone}': 'Мы отправили код на {phone}',
    'Resend code in {n}s': 'Отправить снова через {n} с',
    "Didn't get the code? Resend": 'Не получили код? Отправить заново',
    'Wrong number? ': 'Неверный номер? ',
    'Change it': 'Изменить',
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
    'Price (GEL)': 'Цена (₾)',
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
    'My requests': 'Мои запросы',
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
    'Verification code': 'დადასტურების კოდი',
    'Enter your phone number': 'შეიყვანეთ ტელეფონის ნომერი',
    'Include country code, e.g. +1 555 123 4567': 'მიუთითეთ ქვეყნის კოდი, მაგ. +995 555 12 34 56',
    'Enter your name': 'შეიყვანეთ სახელი',
    'Enter the code you received': 'შეიყვანეთ მიღებული კოდი',
    'Something went wrong': 'რაღაც შეცდომა მოხდა',
    'Network error. Try again.': 'ქსელის შეცდომა. სცადეთ ხელახლა.',
    'Create account': 'ანგარიშის შექმნა',
    'Sign in': 'შესვლა',
    'Send code': 'კოდის გაგზავნა',
    'We’ll text you a one-time code to sign in. No password needed.': 'შესასვლელად გამოგიგზავნით ერთჯერად კოდს. პაროლი არ არის საჭირო.',
    'We sent a code to {phone}': 'კოდი გავგზავნეთ ნომერზე {phone}',
    'Resend code in {n}s': 'კოდის გაგზავნა {n} წამში',
    "Didn't get the code? Resend": 'არ მიგიღიათ კოდი? გაგზავნა',
    'Wrong number? ': 'არასწორი ნომერი? ',
    'Change it': 'შეცვლა',
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
    'Price (GEL)': 'ფასი (₾)',
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
    'My requests': 'ჩემი მოთხოვნები',
  },
};

const I18nContext = createContext({
  lang: DEFAULT_LANG,
  setLang: () => {},
  t: (s) => s,
});

function isSupportedLang(code) {
  return code === 'en' || dict[code] !== undefined;
}

export function I18nProvider({ children }) {
  // New users start in Georgian. Returning users get their saved choice once
  // AsyncStorage resolves (briefly after mount).
  const [lang, setLangState] = useState(DEFAULT_LANG);

  useEffect(() => {
    let cancelled = false;
    Storage.getItem(STORAGE_KEY).then((stored) => {
      if (cancelled) return;
      if (stored && isSupportedLang(stored)) setLangState(stored);
    });
    return () => { cancelled = true; };
  }, []);

  const setLang = useCallback((next) => {
    setLangState(next);
    Storage.setItem(STORAGE_KEY, next);
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
