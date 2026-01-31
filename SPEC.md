# Ferieplan — Product Spec

## Background
The Danish vacation day system.

- The 'vacation obtain period' runs from 1st of September of 'Year 0' to the 31st of August of 'Year 1'
- Vacation obtained in between 1st of September 'Year 0' and the 31st of August 'Year 1' can be used between the 1st of September 'Year 0' and the 31st of December 'Year 1'. Call this the 'vacation usable period'
- Each month, the employee obtains 2,08 vacation days
- At a given month (configurable), the employee receives 5 extra days of vacation.
- Holiday dates are "free" and does not count against the obtained vacation dates.

## The app
The app is a simple client side web app in React where the user can get a year-wide calendar overview.
Based on a set "start date" and a number of vacation allowance on the given start date, the user sees a overview of the current calendar and the next calendar year.

A given `data.json` file contains all the holiday dates possible for each year.

Keep a tally to count if the user has the approriate number of vacation dates available at a given selected date

### UI 
In the left side a configuration pane is visible. Here the user can choose

- Start date
- Vacation days at start date
- For each holiday date the user can toggle enablement.

In the right side is calendar view. A date is marked with a solid semi-transparent circle if date is saved on it:
- Blue: The date is an enabled holiday date (cannot be selected by the user in the calendar view).
- Green: The date is selected by the user and the user has enough vacation days at this point
- Yellow: The date is selected by the user and but the user does not have enough vacation days at this point

Use `shadcn/ui` for UI elements.

### Data
The user selected dates are saved in JavaScript state object that is serialized and saved to localStorage on each update to the state object. When loading the page, we check to see if there is a plan to load from localStorage.

### Non-Functional Requirements
- Client-side only (no backend)
- Browser support: Modern
- Language/locale: da-DK 
