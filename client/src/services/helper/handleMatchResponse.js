const handleMatchResponse = (set, response) => {
  if (response.success && response.matched) {
    set({
      isSuccess: true,
      matchedUser: {
        staffId: response.staffId,
        name: response.userData?.name,
        email: response.userData?.email,
      },
      isMatched: response.matched,
      isLoading: false,
      message: "Fingerprint matched",
    });
  } else {
    set({
      isSuccess: false,
      message: response.message || "No matching fingerprint found",
      isMatched: response.matched,
      isLoading: false,
    });
  }
};

export default handleMatchResponse;
