/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // Design Tokens (Penpot "탐라로그 V2" > Design System — Color / Typography / Spacing & Radius, 2026-07 기준)
      // web(globals.css)과 동일한 값. spacing은 Tailwind 기본 스케일(4px 배수)이 대부분 Penpot 값과 일치해 별도 확장하지 않음
      // spacing/2→p-0.5, /4→p-1, /8→p-2, /10→p-2.5, /12→p-3, /16→p-4, /24→p-6, /30→p-7.5, /32→p-8
      spacing: {
        '7.5': '30px', // v3 기본 스케일엔 없는 값(spacing/30 대응)
      },
      colors: {
        primary: {
          DEFAULT: '#076c8d', // ● base: 800
          50: '#ecf9fd',
          100: '#c5edfa',
          200: '#9ee0f7',
          300: '#75d4f4',
          400: '#4dc9f2',
          500: '#24bdf0',
          600: '#0da8dc',
          700: '#0a8ab5',
          800: '#076c8d',
          900: '#063e51',
          950: '#021217',
        },
        tertiary: {
          DEFAULT: '#cbe7b1', // ● base: 200
          50: '#f1f9e8',
          100: '#e2f2d2',
          200: '#cbe7b1',
          300: '#b0da8b',
          400: '#94cc65',
          500: '#82c34a',
          600: '#77be36',
          700: '#5d992a',
          800: '#45741f',
          900: '#2d4f14',
          950: '#152a09',
        },
        'warm-neutral': {
          DEFAULT: '#63584b', // ● base: 700
          50: '#f6f5f4',
          100: '#e2deda',
          200: '#cfc8c0',
          300: '#bbb2a7',
          400: '#a89b8d',
          500: '#958573',
          600: '#7c6e5e',
          700: '#63584b',
          800: '#463f36',
          900: '#2a2621',
          950: '#0e0d0b',
        },
        'cool-neutral': {
          50: '#f9f9f9',
          100: '#efefef',
          200: '#dddddd',
          300: '#c6c6c6',
          400: '#aaaaaa',
          500: '#888888',
          600: '#6a6a6a',
          700: '#4e4e4e',
          800: '#333333',
          900: '#222222',
          950: '#111111',
          white: '#ffffff',
        },
        'sunny-yellow': {
          50: '#fef9e1',
          100: '#fdf2bb',
          200: '#fbe884',
          300: '#f8dc4c',
          400: '#f2d21e',
          500: '#d5b615',
          600: '#b19210',
          700: '#8b6f0f',
          800: '#685210',
          900: '#4a390f',
          950: '#2c2109',
          975: '#231903',
        },
        'vibrant-orange': {
          50: '#fff3e6',
          100: '#ffe2c2',
          200: '#ffc88f',
          300: '#ffab57',
          400: '#ff8f18',
          500: '#e0780a',
          600: '#bd6005',
          700: '#964803',
          800: '#733705',
          900: '#502605',
          950: '#301502',
          951: '#230f01',
        },
      },
      fontFamily: {
        // RN은 굵기별로 폰트 패밀리가 분리돼 있어 font-bold 같은 fontWeight 유틸로는 두께가 안 바뀜.
        // font-pretendard-* 유틸로 굵기에 맞는 패밀리를 직접 지정해서 사용 (폰트는 app/_layout.tsx에서 expo-font로 로드)
        // 여기 있는 굵기는 _layout.tsx의 useFonts에 실린 것과 **같아야 한다**.
        // 유틸만 남기면 RN이 없는 패밀리를 조용히 시스템 폰트로 폴백해 원인을 찾기 어렵다.
        // Thin·ExtraLight·Light·ExtraBold는 사용처가 0곳이라 양쪽에서 함께 뺐다.
        sans: ['Pretendard-Regular'],
        'pretendard-regular': ['Pretendard-Regular'],
        'pretendard-medium': ['Pretendard-Medium'],
        'pretendard-semibold': ['Pretendard-SemiBold'],
        'pretendard-bold': ['Pretendard-Bold'],
        'pretendard-black': ['Pretendard-Black'],
      },
      fontSize: {
        'display-lg': ['36px', { lineHeight: '40px' }],
        'display-md': ['30px', { lineHeight: '36px' }],
        'heading-h1': ['32px', { lineHeight: '48px' }],
        'heading-h2': ['24px', { lineHeight: '36px' }],
        'heading-h3': ['20px', { lineHeight: '30px' }],
        'heading-h4': ['18px', { lineHeight: '26px' }],
        'body-lg': ['16px', { lineHeight: '24px' }],
        'body-md': ['14px', { lineHeight: '22px' }],
        'body-sm': ['12px', { lineHeight: '18px' }],
        'label-lg': ['16px', { lineHeight: '24px' }],
        'label-md': ['14px', { lineHeight: '20px' }],
        'label-sm': ['12px', { lineHeight: '16px' }],
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '14px',
        xl: '16px',
        full: '999px',
      },
    },
  },
  plugins: [],
};
