# Roadster Racer

테슬라 로드스터 2로 오스틴에서 화성까지 달리는 아케이드 액션 레이싱. 웹 브라우저(PC, 휴대폰)에서 바로 돌아가는 Three.js 게임이에요.

## 지금 들어있는 것 (1단계: 오스틴)
- 압축공기 점프 (시작 3회, 레벨업마다 +1, 8초마다 자동 충전)
- 공중에서 점프 버튼을 꾹 누르면 분사 착지, 퍼펙트 랜딩 시 속도 보너스
- 경사로, 끊긴 콩그레스 애비뉴 다리 점프
- 라이다로 겁먹고 급정거하는 웨이모, 사이버캡 로보택시
- RTX 5090 / H100 / 전설의 블랙웰 칩(경험치), 도지코인(돈), 압축공기 통
- 실사 석양 HDRI 조명(CC0, Poly Haven "Venice Sunset"), 블룸

## 조작
- PC: ← → 조향, Space 점프(공중에서 꾹 = 착지 분사), Shift 부스트, ↓ 브레이크
- 휴대폰: 화면 버튼

## 로컬 실행
```
npx http-server -p 8080 .
```
그다음 http://localhost:8080 을 열어요.

## 구조
- `index.html` 화면, HUD, 포스터
- `src/game.js` 트랙, 물리, 게임 진행
- `src/models.js` 차량과 GPU 모델 (나중에 GLB 모델로 교체 예정)
- `tools/build-artifact.mjs` claude.ai 아티팩트용 페이지 생성

## 아이폰 앱 (TestFlight)
- `ios-app/`: 게임을 앱 안에 넣어 띄우는 아이폰 앱 (가로 화면, 진동은 아이폰 햅틱). 게임 파일은 빌드 때 `node tools/build-ios-web.mjs`가 `ios-app/web/`으로 복사해요.
- `codemagic.yaml`: Codemagic에서 서명하고 TestFlight에 올려요. 육아앱(babylog)과 같은 API 키·인증서를 써요. 새 맵을 아이폰에서 하려면 Codemagic에서 "Start new build".
- `.github/workflows/ios.yml`: 아이폰 코드가 빌드되는지만 확인해요(서명 없음).
