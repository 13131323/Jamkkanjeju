/**
 * orval `input.override.transformer` — multipart 파일 배열의 nullable 래퍼를 벗긴다.
 *
 * ## 문제
 *
 * 서버가 `imageFiles`/`audioFiles`를 `list[UploadFile] | None`으로 바꾸면서 스키마가 이렇게 됐다:
 *
 * ```json
 * { "anyOf": [ { "items": { "type": "string", "format": "binary" }, "type": "array" }, { "type": "null" } ] }
 * ```
 *
 * `anyOf`로 감싸이면 orval이 그 필드를 배열로 알아보지 못한다. 그러면 `arrayHandling: 'explode'`가
 * 적용되지 않고 배열을 통째로 `formData.append(key, array)`로 넣는 코드가 나온다 — 타입이 깨지고
 * (append는 Blob 하나만 받는다) 서버도 파일을 못 읽는다. FastAPI의 `list[UploadFile]`은 같은 키를
 * 반복해서 받기 때문이다.
 *
 * ## 해법
 *
 * 생성 **전에** 스펙에서 `anyOf: [<array of binary>, null]`을 배열 스키마로 되돌린다.
 * 그러면 orval이 예전처럼 배열로 인식해 `forEach(v => formData.append(key, v))`를 만든다.
 * nullable이라는 정보는 `nullable: true`로 남겨 타입에 반영된다.
 *
 * ## 범위를 좁게 둔 이유
 *
 * FastAPI는 **모든** optional 필드를 `anyOf[..., null]`로 내보낸다. 그걸 다 펴면 생성되는 타입이
 * 전부 바뀌어 확인할 것이 폭발한다. 그래서 조건을 셋 다 만족할 때만 손댄다:
 *   1. `anyOf`가 정확히 두 갈래이고 한쪽이 `{"type":"null"}`
 *   2. 다른 한쪽이 `type: "array"`
 *   3. 그 배열의 항목이 `format: "binary"`(= 업로드 파일)
 *
 * 즉 "nullable 파일 배열"만 대상이다. 서버가 `| None`을 걷어내면 이 변환기는 아무것도 하지 않게
 * 되므로 그때 지우면 된다.
 */

/** `{"type":"null"}` 갈래인지 */
function isNullBranch(schema) {
  return schema !== null && typeof schema === 'object' && schema.type === 'null' && !schema.anyOf && !schema.$ref;
}

/** 업로드 파일 배열 갈래인지 */
function isBinaryArrayBranch(schema) {
  return schema !== null && typeof schema === 'object' && schema.type === 'array' && schema.items?.format === 'binary';
}

/** 대상이면 펴진 스키마를, 아니면 null을 준다 */
function unwrapNullableFileArray(schema) {
  if (!Array.isArray(schema?.anyOf) || schema.anyOf.length !== 2) return null;

  const nullBranch = schema.anyOf.find(isNullBranch);
  const arrayBranch = schema.anyOf.find(isBinaryArrayBranch);
  if (!nullBranch || !arrayBranch) return null;

  // anyOf만 걷어내고 나머지 메타(title, description 등)는 그대로 둔다
  const { anyOf, ...rest } = schema;
  return { ...rest, ...arrayBranch, nullable: true };
}

/** 스키마 객체의 properties를 훑어 대상 필드를 바꾼다. 바꾼 개수를 돌려준다 */
function transformProperties(schema) {
  if (!schema?.properties) return 0;

  let changed = 0;
  for (const [key, property] of Object.entries(schema.properties)) {
    const unwrapped = unwrapNullableFileArray(property);
    if (unwrapped) {
      schema.properties[key] = unwrapped;
      changed += 1;
    }
  }
  return changed;
}

export default function transformer(spec) {
  let changed = 0;

  for (const schema of Object.values(spec.components?.schemas ?? {})) {
    changed += transformProperties(schema);
  }

  // multipart 본문이 인라인 스키마로 오는 경우도 있어 경로 쪽도 함께 훑는다
  for (const operations of Object.values(spec.paths ?? {})) {
    for (const operation of Object.values(operations)) {
      const inline = operation?.requestBody?.content?.['multipart/form-data']?.schema;
      if (inline) changed += transformProperties(inline);
    }
  }

  // 조용히 아무것도 안 하면 서버가 필드를 고친 뒤에도 이 파일이 남아 있는지 알 수 없다
  console.log(`[orval] nullable 파일 배열 ${changed}개를 배열 스키마로 되돌렸습니다.`);

  return spec;
}
