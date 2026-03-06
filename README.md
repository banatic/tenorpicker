# CoolMessenger Tenor Picker

CoolMessenger 사용자를 위한 Tenor 기반의 GIF 검색 및 선택기능을 제공하는 Tauri 데스크톱 애플리케이션입니다.

## 기능 (Features)

- **Tenor GIF 검색 및 트렌딩 확인:** 간편하게 최신 유행하는 GIF와 특정 키워드의 GIF를 검색할 수 있습니다.
- **클릭하여 복사 (Click to Copy):** 원하는 GIF를 클릭하면 바로 클립보드에 HTML 형태로 복사되어 CoolMessenger 등의 지원하는 메신저에 바로 붙여넣을 수 있습니다.
- **자동 창 인식:** 대상 애플리케이션 창(CoolMessenger)을 감지하여 해당 창 근처에 자동으로 위치합니다.
- **가벼운 리소스 사용:** Tauri 2.0 프레임워크와 Rust를 기반으로 구축되어 작고 빠릅니다.

## 개발 환경 (Development)

프로젝트를 로컬 환경에서 실행하고 빌드하려면 [Node.js](https://nodejs.org/)와 [Rust/Tauri 환경](https://tauri.app/v1/guides/getting-started/prerequisites)이 필요합니다.

### 명령어

```sh
# 패키지 설치
npm install

# 개발 서버 및 데스크톱 앱 실행
npm run tauri dev

# 프로덕션 빌드
npm run tauri build
```

## 기술 스택 (Tech Stack)

- **Frontend:** Vanilla HTML, CSS, JavaScript (Glassmorphism 디자인 적용)
- **Backend:** Rust, Tauri 2.0
- **Crawling:** Rust `reqwest` & `regex`를 사용한 무설정(Zero-config) HTML 파싱
