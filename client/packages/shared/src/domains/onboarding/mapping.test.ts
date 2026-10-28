import { describe, expect, it } from 'vitest';
import {
  SPARE_TIME_STYLE_OPTIONS,
  TRANSPORTATION_OPTIONS,
  TRAVEL_INTEREST_OPTIONS,
} from './constants';
import { CATEGORY_BY_INTEREST, INTEREST_BY_CATEGORY, TRANSPORTATION_BY_ID, TRANSPORTATION_ID_BY_TRANSPORTATION, TRAVEL_STYLE_BY_ID } from './mapping';
import { buildOnboardingSaveRequest } from './request';

describe('온보딩 enum 매핑', () => {
  it('세 매핑이 화면 선택지를 빠짐없이 덮는다', () => {
    for (const option of TRAVEL_INTEREST_OPTIONS) {
      expect(CATEGORY_BY_INTEREST[option.id]).toBeDefined();
    }
    for (const option of TRANSPORTATION_OPTIONS) {
      expect(TRANSPORTATION_BY_ID[option.id]).toBeDefined();
    }
    for (const option of SPARE_TIME_STYLE_OPTIONS) {
      expect(TRAVEL_STYLE_BY_ID[option.id]).toBeDefined();
    }
  });

  it('화면 id를 서버 enum으로 바꾼다', () => {
    expect(CATEGORY_BY_INTEREST.walk).toBe('WALKING');
    expect(TRANSPORTATION_BY_ID.rental).toBe('CAR');
    expect(TRAVEL_STYLE_BY_ID.here).toBe('RIGHT_HERE');
  });

  it('역매핑이 정매핑과 왕복된다', () => {
    for (const option of TRAVEL_INTEREST_OPTIONS) {
      expect(INTEREST_BY_CATEGORY[CATEGORY_BY_INTEREST[option.id]]).toBe(option.id);
    }
    for (const option of TRANSPORTATION_OPTIONS) {
      expect(TRANSPORTATION_ID_BY_TRANSPORTATION[TRANSPORTATION_BY_ID[option.id]]).toBe(option.id);
    }
  });
});

describe('buildOnboardingSaveRequest', () => {
  it('"나중에 할게요"는 빈 바디를 만든다', () => {
    expect(buildOnboardingSaveRequest(null)).toEqual({});
  });

  it('단일 선택값을 서버 스펙대로 배열로 감싼다', () => {
    expect(
      buildOnboardingSaveRequest({
        travelInterests: ['photo', 'local'],
        transportation: 'rental',
        spareTimeStyle: 'here',
      }),
    ).toEqual({
      categories: ['PHOTO', 'LOCAL'],
      transportation: ['CAR'],
      travelStyle: ['RIGHT_HERE'],
    });
  });

  it('고르지 않은 항목은 키 자체를 넣지 않는다', () => {
    const body = buildOnboardingSaveRequest({
      travelInterests: [],
      transportation: null,
      spareTimeStyle: null,
    });

    expect(body).toEqual({});
    expect('categories' in body).toBe(false);
  });
});
