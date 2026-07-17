export const SITE = {
  website: "https://abhijeetwarhekar.me/",
  author: "Abhijeet Warhekar",
  profile: "https://abhijeetwarhekar.me/about",
  desc: "A personal blog where I write about software, tools, and things I find interesting.",
  title: "Abhijeet Warhekar", // TODO: replace with your blog title
  ogImage: "astropaper-og.jpg",
  lightAndDarkMode: true,
  postPerIndex: 4,
  postPerPage: 4,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: true,
  showBackButton: true,
  editPost: {
    enabled: false,
    text: "Edit page",
    url: "",
  },
  dynamicOgImage: true,
  dir: "ltr",
  lang: "en",
  timezone: "Asia/Kolkata",
} as const;
