import { describe, expect, it } from 'vitest';
import { isCorrectAnswer, resolveCurrentQuizIndex, resolveQuizAdvance, resolveResumeIndex, toPlayableQuizzes } from './cultureQuiz';

const multipleChoice = {
  quizIndex: 1,
  imgUrl: 'https://example.com/a.jpg',
  question: '제주어로 할아버지는?',
  options: ['하르방', '하라범', '하르봉', '하르범'],
  answer: '하르방',
  hint: '돌하르방을 떠올려 보세요.',
  explanation: '제주어에서 할아버지는 하르방입니다.',
};

const shortAnswer = {
  quizIndex: 3,
  imgUrl: null,
  question: "'하영'은 제주 방언으로 어떤 뜻일까요?",
  options: null,
  answer: '많이',
  hint: '수량이 넉넉하다는 의미예요.',
  explanation: '하영은 많이라는 뜻입니다.',
};

describe('toPlayableQuizzes', () => {
  it('quizIndex 오름차순으로 정렬한다', () => {
    const sorted = toPlayableQuizzes([
      { ...multipleChoice, quizIndex: 2 },
      { ...multipleChoice, quizIndex: 1 },
    ]);

    expect(sorted.map((quiz) => quiz.quizIndex)).toEqual([1, 2]);
  });

  it('주관식(options: null)은 아직 화면이 없어 제외한다', () => {
    const playable = toPlayableQuizzes([multipleChoice, shortAnswer]);

    expect(playable).toHaveLength(1);
    expect(playable[0].quizIndex).toBe(1);
  });

  it('보기가 빈 배열이면 고를 것이 없으므로 제외한다', () => {
    expect(toPlayableQuizzes([{ ...multipleChoice, options: [] }])).toHaveLength(0);
  });

  it('빈 목록은 빈 배열이다', () => {
    expect(toPlayableQuizzes([])).toEqual([]);
  });
});

describe('resolveResumeIndex', () => {
  const quizzes = toPlayableQuizzes([
    { ...multipleChoice, quizIndex: 1 },
    { ...multipleChoice, quizIndex: 2 },
    { ...multipleChoice, quizIndex: 4 },
  ]);

  it('신규 진행도(1)는 첫 문제부터 시작한다', () => {
    expect(resolveResumeIndex(quizzes, 1)).toBe(0);
  });

  it('이어하기는 해당 quizIndex의 위치로 간다', () => {
    expect(resolveResumeIndex(quizzes, 4)).toBe(2);
  });

  it('건너뛴 번호(주관식 등)를 가리키면 그 다음으로 풀 수 있는 문제로 넘어간다', () => {
    expect(resolveResumeIndex(quizzes, 3)).toBe(2);
  });

  it('남은 문제가 없으면 마지막 문제에 머문다 — 화면이 빈 상태가 되지 않게', () => {
    expect(resolveResumeIndex(quizzes, 99)).toBe(2);
  });

  it('문제가 하나도 없으면 0이다', () => {
    expect(resolveResumeIndex([], 1)).toBe(0);
  });
});

describe('resolveCurrentQuizIndex', () => {
  const quizzes = toPlayableQuizzes([
    { ...multipleChoice, quizIndex: 1 },
    { ...multipleChoice, quizIndex: 2 },
    { ...multipleChoice, quizIndex: 4 },
  ]);

  it('아직 한 문제도 넘기지 않았으면 이어하기 위치가 곧 현재 위치다', () => {
    // 이게 파생 값이어야 하는 이유: effect로 옮기면 응답이 온 프레임에 1번 문제가 먼저 그려진다
    expect(resolveCurrentQuizIndex(null, quizzes, 4)).toBe(2);
  });

  it('한 문제라도 넘긴 뒤에는 이어하기 위치를 다시 보지 않는다', () => {
    // 서버가 준 위치로 되돌아가면 사용자의 진행이 덮인다
    expect(resolveCurrentQuizIndex(0, quizzes, 4)).toBe(0);
  });

  it('응답 전(문제 목록이 비었고 번호가 폴백 1)에는 0이다', () => {
    expect(resolveCurrentQuizIndex(null, [], 1)).toBe(0);
  });
});

describe('isCorrectAnswer', () => {
  it('보기 문자열과 정답 문자열을 비교한다 — 서버 정답은 번호가 아니라 문자열이다', () => {
    expect(isCorrectAnswer('하르방', '하르방')).toBe(true);
    expect(isCorrectAnswer('하라범', '하르방')).toBe(false);
  });

  it('앞뒤 공백은 무시한다', () => {
    expect(isCorrectAnswer(' 하르방 ', '하르방')).toBe(true);
  });

  it('고른 보기가 없으면 오답이다', () => {
    expect(isCorrectAnswer(null, '하르방')).toBe(false);
  });
});

describe('resolveQuizAdvance', () => {
  it('서버가 완료로 응답하면 완료 화면으로 간다', () => {
    expect(resolveQuizAdvance('COMPLETED', 0, 3)).toBe('complete');
  });

  it('완료면 마지막 문제가 아니어도 완료가 먼저다', () => {
    // 주관식이 걸러져 화면의 문제 수가 서버보다 적으면, 첫 문제에서 바로 완료가 올 수 있다
    expect(resolveQuizAdvance('COMPLETED', 0, 2)).toBe('complete');
  });

  it('아직 진행 중이고 남은 문제가 있으면 다음 문제로 간다', () => {
    expect(resolveQuizAdvance('IN_PROGRESS', 0, 3)).toBe('next');
    expect(resolveQuizAdvance('IN_PROGRESS', 1, 3)).toBe('next');
  });

  it('마지막 문제인데 서버가 아직 진행 중이면 중단으로 끝낸다', () => {
    // 이 갈래가 없어서 마지막 문제에서 "다음"을 눌러도 화면이 그대로였다(사용자 확인)
    expect(resolveQuizAdvance('IN_PROGRESS', 2, 3)).toBe('stop');
  });

  it('문제가 하나뿐이면 그 문제가 곧 마지막이다', () => {
    expect(resolveQuizAdvance('IN_PROGRESS', 0, 1)).toBe('stop');
  });
});
