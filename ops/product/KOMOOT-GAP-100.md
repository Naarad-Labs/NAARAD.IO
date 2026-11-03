# Closing the gap to Komoot: 100 points

Basis: a side-by-side of komoot.com (Discover, Hiking trails, a Collection) and our catalogue and route page, 2026-11-03. Naarad keeps what Komoot does not have (spoken guide in eight Indian languages, stories at each stop, heritage content); this list closes what a visitor would miss.

Tags: `[site]` the public site, no backend. `[app]` NAARAD-APP web or API code. `[needs-db]` waits for Terraform and the database (founder). `[content]` needs editorial or photo work. `[founder]` a decision or account step only the founder can do. Items marked ★ (eight of them) are the ones to do first.

Where we already match (not repeated below): distance, duration, stop count, difficulty, terrain line, elevation sparkline on cards and route pages; filters by activity, region and "has story stops"; route page tabs (Overview, Stops, Stories, Terrain, Map); Share, Save and Listen buttons.

## A. Map cards and previews (1-12)
1. ★ `[site]` Draw the route over real map tiles on every catalogue card, not a plain grid.
2. `[site]` Fit each card's map to the route's bounds with even padding.
3. `[site]` Cache card map images so the list does not fetch tiles on every scroll.
4. `[site]` Pre-render a static map image per route at build time for the card and the share card.
5. `[site]` Number the stops on the card map only when there is room; otherwise show start and end.
6. `[site]` Show a tile-free fallback that looks intentional when tiles fail or the visitor is offline.
7. `[site]` Credit the map data on every map, in the corner, as the data licence requires.
8. `[site]` Add a "difficulty" ribbon on the card map corner, as Komoot does.
9. `[site]` Make the route-page map larger and sticky beside the stop list on desktop.
10. `[site]` Add zoom and fit-to-route buttons to every map.
11. `[site]` Add a fullscreen map view with the stop list as a drawer.
12. `[site]` Highlight the stop the visitor is hearing on the map and scroll the list to it.

## B. Photos and media (13-22)
13. ★ `[site]` Show a photo strip of five or more images on each route page, with an "N images" button.
14. `[content]` Source and credit at least five licensed photos per published route.
15. `[site]` Open photos in a swipeable lightbox with captions and credits.
16. `[site]` Lazy-load below-the-fold photos and reserve their space so the page does not jump.
17. `[site]` Fix any hero image that renders blank (check the Hampi hero on the live site).
18. `[site]` Serve images in modern formats at the sizes shown.
19. `[site]` Add a photo mosaic at the top of collections and region pages, as Komoot's London page does.
20. `[content]` Add a photo for every stop, with place and credit.
21. `[site]` Show the photo credit and licence on the image, not only in the page footer.
22. `[site]` Let a visitor view a stop's photo alongside its audio player.

## C. Discover and home entry (23-34)
23. ★ `[site]` Make the first screen of Explore a picker: activity, place search, then category tiles.
24. `[site]` Add large category tiles (heritage walks, temple circuits, coastal trails, cycling, wildlife) with a photo each.
25. `[site]` Add "near me" as a prominent entry, asking for location only when tapped.
26. `[site]` Add search suggestions for places, routes and themes as the visitor types.
27. `[site]` Add recent searches stored on the device only.
28. `[site]` Add a "popular around this place" rail on route pages.
29. `[site]` Add a "more routes in this region" section at the bottom of every route.
30. `[site]` Add breadcrumbs (Routes / Region / Route) on every page, matching Komoot's pattern.
31. `[site]` Add a persistent but quiet "Open the app" prompt on phones.
32. `[site]` Add a sign-in and sign-up button in the header that shows once sign-in is live.
33. `[site]` Make the header search the same control on every page.
34. `[site]` Add an "updated on" date to each route and collection.

## D. Collections and curation (35-44)
35. ★ `[site]` Group routes into themed Collections (for example "Temple towns of Tamil Nadu") with their own pages.
36. `[content]` Write the first ten Collections with an introduction each.
37. `[site]` Show the curator's name and avatar on every Collection and route.
38. `[site]` Add Collection cards with a photo, title and curator, as Komoot's grid.
39. `[site]` Add Filter by region and Filter by category controls above the Collection grid.
40. `[site]` Add a "read more" fold to Collection introductions.
41. `[site]` Give every Collection a share card and a canonical address.
42. `[site]` List the Collections in the sitemap and prerender them.
43. `[site]` Add "Collections that include this route" on route pages.
44. `[content]` Add seasonal Collections (monsoon, winter, festivals).

## E. Filters and search (45-54)
45. ★ `[site]` Add distance, duration and difficulty range filters.
46. `[site]` Add a "has audio in my language" filter.
47. `[site]` Add a "works offline" filter for downloadable routes.
48. `[site]` Add a sort control: nearest, shortest, longest, most stories.
49. `[site]` Show active filters as removable chips and a clear-all button.
50. `[site]` Keep filters in the address so a filtered view can be shared.
51. `[site]` Add an "easy only" quick filter like Komoot's.
52. `[site]` Show the result count and an honest empty state with next steps.
53. `[site]` Add accessibility filters (step-free, shaded, benches), shown only where we have data.
54. `[content]` Collect the accessibility data for the first twenty routes.

## F. Route page (55-66)
55. ★ `[site]` Add an interactive elevation profile that follows the map cursor, with total ascent and descent.
56. `[site]` Add a surface and way-type breakdown (paved, dirt, steps) where data exists.
57. `[site]` Add "highlights" along the route as numbered points with photos, as well as stops.
58. `[site]` Add best-time-to-visit and season notes.
59. `[site]` Add a safety and etiquette block for sacred or sensitive sites.
60. `[site]` Add a "how to get there" block with public-transport and parking notes.
61. `[site]` Add a GPX download for each route.
62. `[site]` Add "Send to phone" through a share link.
63. `[site]` Add print view for a route sheet.
64. `[site]` Show the stop list with audio length and languages per stop.
65. `[site]` Add structured data (route, place, photos) for search results.
66. `[site]` Make the Listen button resume where the visitor stopped.

## G. Social proof and community (67-76)
67. `[needs-db]` Add star ratings on routes after a visitor has completed or heard them.
68. `[needs-db]` Show "N people have walked this" counts, only once real, never invented.
69. `[needs-db]` Let signed-in visitors add a tip or a photo to a stop, held for moderation.
70. `[needs-db]` Add a report button for wrong or unsafe information.
71. `[founder]` Decide moderation staffing and response times before opening contributions.
72. `[needs-db]` Add public creator profiles with their routes.
73. `[needs-db]` Let visitors follow a creator.
74. `[needs-db]` Add a "recently walked" list on My Journey.
75. `[site]` Add testimonials only from real, consenting visitors; none until we have them.
76. `[needs-db]` Add a creator's published-routes page with a share card.

## H. Navigation and walk mode (77-86)
77. ★ `[app]` Build live walk mode: current position on the route and the next stop.
78. `[app]` Trigger each stop's audio by arrival, using the cue-timing rules already written.
79. `[app]` Speak the turn instruction before each turn, using the instruction builder already written.
80. `[app]` Show distance to the next stop and remaining time.
81. `[app]` Warn when the visitor leaves the route and offer a way back.
82. `[app]` Keep walk mode working with the screen locked.
83. `[app]` Add a battery-saver mode that reduces position updates.
84. `[app]` Add pause, skip stop and replay controls.
85. `[app]` Record the walk locally and offer to save it to My Journey.
86. `[app]` Add a clear permission explanation before asking for location.

## I. Planner and recording (87-94)
87. `[app]` Let a visitor build a custom route by picking stops from the catalogue.
88. `[app]` Show an estimated walking time and distance for the custom route.
89. `[app]` Save custom routes to My Journey.
90. `[app]` Let a creator draw a route on the map in the studio.
91. `[app]` Let a creator record a walk to a GPX track.
92. `[app]` Snap a drawn route to paths where path data allows.
93. `[app]` Add an undo and redo to the route drawer.
94. `[app]` Export a custom route as GPX.

## J. Accounts, sync and offline (95-100)
95. ★ `[founder]` Run Terraform, point `app.naarad.io` at our app, set the three GitHub variables (blocks every `[needs-db]` item).
96. `[needs-db]` Sync saved routes, walks and listening time to the account.
97. `[app]` Wire the delete-my-account button to the server, ahead of public sign-in.
98. `[site]` Make offline map tiles part of a route download, within the storage budget.
99. `[site]` Show download size and storage left before a route is downloaded.
100. `[app]` Add Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali and Marathi interface text for the app shell, not only the audio.

## The starred eight (★), in order
1 map tiles on cards, 13 photo strip, 23 Explore picker, 35 Collections, 45 range filters, 55 elevation profile, 77 walk mode, 95 Terraform and DNS. Items 1, 13, 23, 35, 45 and 55 need no backend and can start now; 77 needs only the app repo; 95 is yours.
