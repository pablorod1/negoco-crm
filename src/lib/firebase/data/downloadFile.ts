export const downloadFile = async (
  download_url: string,
  file_name: string
): Promise<{ success: boolean; errors?: string }> => {
  try {
    const response = await fetch(download_url);
    if (!response.ok) {
      return { success: false, errors: "Network response was not ok" };
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = file_name;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);

    return { success: true };
  } catch (error) {
    console.error("Error downloading file:", error);
    return { success: false, errors: "Error downloading file" };
  }
};
