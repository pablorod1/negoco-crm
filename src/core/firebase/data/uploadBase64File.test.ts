import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  getDownloadURL: vi.fn(),
  ref: vi.fn(),
  unsubscribe: vi.fn(),
  uploadBytesResumable: vi.fn(),
}));

vi.mock("@/core/firebase/firebaseConfig", () => ({
  storage: { name: "test-storage" },
}));
vi.mock("firebase/storage", () => ({
  getDownloadURL: mocks.getDownloadURL,
  ref: mocks.ref,
  uploadBytesResumable: mocks.uploadBytesResumable,
}));

const { uploadBase64File } = await import("./uploadBase64File");

let failUpload: (error: unknown) => void;
let finishUpload: () => void;
const storageRef = { fullPath: "documents/test.pdf" };
const snapshotRef = { fullPath: "documents/test.pdf" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.ref.mockReturnValue(storageRef);
  mocks.uploadBytesResumable.mockReturnValue({
    cancel: mocks.cancel,
    on: vi.fn(
      (
        _event: string,
        _progress: unknown,
        error: (reason: unknown) => void,
        complete: () => void,
      ) => {
        failUpload = error;
        finishUpload = complete;
        return mocks.unsubscribe;
      },
    ),
    snapshot: { ref: snapshotRef },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("uploadBase64File", () => {
  test("uploads and resolves the download URL", async () => {
    mocks.getDownloadURL.mockResolvedValue(
      "https://storage.example/test.pdf",
    );

    const upload = uploadBase64File(
      Buffer.from("%PDF-1.7").toString("base64"),
      "documents/test.pdf",
      "application/pdf",
    );
    finishUpload();

    await expect(upload).resolves.toEqual({
      downloadURL: "https://storage.example/test.pdf",
    });
    expect(mocks.getDownloadURL).toHaveBeenCalledWith(snapshotRef);
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  });

  test("rejects an already-aborted upload before creating a task", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      uploadBase64File(
        Buffer.from("document").toString("base64"),
        "documents/test.pdf",
        "application/pdf",
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(mocks.uploadBytesResumable).not.toHaveBeenCalled();
  });

  test("cancels and rejects when aborted during upload", async () => {
    const controller = new AbortController();
    const upload = uploadBase64File(
      Buffer.from("document").toString("base64"),
      "documents/test.pdf",
      "application/pdf",
      { signal: controller.signal },
    );

    controller.abort();

    await expect(upload).rejects.toMatchObject({ name: "AbortError" });
    expect(mocks.cancel).toHaveBeenCalledOnce();
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  });

  test("cancels and rejects after the configured timeout", async () => {
    vi.useFakeTimers();
    const upload = uploadBase64File(
      Buffer.from("document").toString("base64"),
      "documents/test.pdf",
      "application/pdf",
      { timeoutMs: 1_000 },
    );
    const rejection = expect(upload).rejects.toMatchObject({
      name: "AbortError",
    });

    await vi.advanceTimersByTimeAsync(1_000);

    await rejection;
    expect(mocks.cancel).toHaveBeenCalledOnce();
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  });

  test("propagates an upstream upload error", async () => {
    const uploadError = new Error("Firebase upload failed");
    const upload = uploadBase64File(
      Buffer.from("document").toString("base64"),
      "documents/test.pdf",
      "application/pdf",
    );

    failUpload(uploadError);

    await expect(upload).rejects.toBe(uploadError);
    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(mocks.getDownloadURL).not.toHaveBeenCalled();
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  });
});
